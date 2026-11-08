import { ConnectionId } from "spacetimedb";
import { createModuleTestHarness, TestAuth } from "spacetimedb/server/test-utils";
import { describe, expect, it } from "vitest";
import spacetimedb, * as moduleExports from "./index";

let connectionSequence = 1n;

function principal(subject: string): TestAuth {
  return TestAuth.fromJwtPayload(
    JSON.stringify({ issuer: "interlock-test", sub: subject, iss: "https://test.interlock" }),
    new ConnectionId(connectionSequence++),
  );
}

/** A signed-in user from an identity provider, with optional custom claims. */
function clerkUser(subject: string, claims: Record<string, unknown> = {}, iss = CLERK_ISSUER): TestAuth {
  return TestAuth.fromJwtPayload(
    JSON.stringify({ sub: subject, iss, aud: "spacetimedb", ...claims }),
    new ConnectionId(connectionSequence++),
  );
}

const CLERK_ISSUER = "https://interlock-test.clerk.accounts.dev";

function createHarness() {
  const test = createModuleTestHarness(spacetimedb, moduleExports);
  const owner = principal("publisher");
  test.withReducerTx(owner, (ctx) => moduleExports.init(ctx, {}));
  return { test, owner };
}

const validIncident = {
  incidentId: "123e4567-e89b-42d3-a456-426614174000",
  exposure: "carrier_account",
  severity: "high",
  urgency: "urgent",
  consent: true,
};

type Harness = ReturnType<typeof createHarness>["test"];

function submit(test: Harness, auth: TestAuth, values = validIncident) {
  test.withReducerTx(auth, (ctx) => moduleExports.submitIncident(ctx, values));
}

describe("durable incident module authorization", () => {
  it("stores a consented minimal record and coarse timestamp", () => {
    const { test } = createHarness();
    const customer = principal("customer");
    submit(test, customer);

    const incidents = [...test.db.incident.iter()];
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      id: validIncident.incidentId,
      exposure: "carrier_account",
      severity: "high",
      urgency: "urgent",
      status: "submitted",
    });
    expect(incidents[0]!.owner.isEqual(test.viewContext(customer).sender)).toBe(true);
    expect(incidents[0]!.createdAt.microsSinceUnixEpoch % 3_600_000_000n).toBe(0n);
    expect(test.db.statusEvent.count()).toBe(1n);
    expect(Object.keys(incidents[0]!)).toEqual([
      "id", "owner", "createdAt", "updatedAt", "consentedAt", "exposure", "severity", "urgency", "status",
    ]);
  });

  it("rejects duplicate IDs, invalid enums, malformed IDs, and missing consent", () => {
    const { test } = createHarness();
    const customer = principal("customer");
    submit(test, customer);
    expect(() => submit(test, customer)).toThrow("Incident ID already exists");
    expect(() => submit(test, customer, { ...validIncident, incidentId: "not-a-uuid" }))
      .toThrow("Incident ID must be a UUID");
    expect(() => submit(test, customer, { ...validIncident, exposure: "raw-message" }))
      .toThrow("Unknown exposure category");
    expect(() => submit(test, customer, { ...validIncident, severity: "extreme" }))
      .toThrow("Unknown severity");
    expect(() => submit(test, customer, { ...validIncident, urgency: "whenever" }))
      .toThrow("Unknown urgency");
    expect(() => submit(test, customer, { ...validIncident, consent: false }))
      .toThrow("Explicit consent is required");
    expect(test.db.incident.count()).toBe(1n);
    expect(test.db.statusEvent.count()).toBe(1n);
  });

  it("shows customer incidents only to their authenticated owner identity", () => {
    const { test } = createHarness();
    const alice = principal("alice");
    const bob = principal("bob");
    submit(test, alice);
    submit(test, bob, { ...validIncident, incidentId: "223e4567-e89b-42d3-a456-426614174000" });

    const rowsFor = (auth: TestAuth) =>
      moduleExports.myIncidents(test.viewContext(auth)).map((row) => row.id);
    expect(rowsFor(alice)).toEqual([validIncident.incidentId]);
    expect(rowsFor(bob)).toEqual(["223e4567-e89b-42d3-a456-426614174000"]);
  });

  it("hides operator incidents from customers and denies unauthorized status writes", () => {
    const { test } = createHarness();
    const customer = principal("customer");
    submit(test, customer);

    expect(test.runQuery(moduleExports.operatorIncidents(test.viewContext(customer)))).toHaveLength(0);
    expect(() => test.withReducerTx(customer, (ctx) => moduleExports.setIncidentStatus(ctx, {
      incidentId: validIncident.incidentId,
      status: "acknowledged",
    }))).toThrow("Operator authorization required");
    expect(test.db.incident.id.find(validIncident.incidentId)?.status).toBe("submitted");
  });

  it("shows incident records to an owner-provisioned operator identity", () => {
    const { test, owner } = createHarness();
    const customer = principal("customer");
    const operatorAuth = principal("operator");
    const operatorIdentity = test.viewContext(operatorAuth).sender;
    submit(test, customer);
    test.withReducerTx(owner, (ctx) => moduleExports.grantOperator(ctx, { identity: operatorIdentity }));

    const visible = test.runQuery<{ id: string }>(moduleExports.operatorIncidents(test.viewContext(operatorAuth)));
    expect(visible.map((row) => row.id)).toEqual([validIncident.incidentId]);
  });

  it("prevents customer and operator role escalation and permits owner provisioning", () => {
    const { test, owner } = createHarness();
    const customer = principal("customer");
    const operatorAuth = principal("operator");
    const customerIdentity = test.viewContext(customer).sender;
    const operatorIdentity = test.viewContext(operatorAuth).sender;

    expect(() => test.withReducerTx(customer, (ctx) => moduleExports.grantOperator(ctx, {
      identity: customerIdentity,
    }))).toThrow("Only the database owner can provision operators");

    test.withReducerTx(owner, (ctx) => moduleExports.grantOperator(ctx, { identity: operatorIdentity }));
    expect(() => test.withReducerTx(operatorAuth, (ctx) => moduleExports.grantOperator(ctx, {
      identity: customerIdentity,
    }))).toThrow("Only the database owner can provision operators");

    expect(() => test.withReducerTx(owner, (ctx) => moduleExports.grantOperator(ctx, {
      identity: test.viewContext(owner).sender,
    }))).toThrow("The database owner role cannot be changed");
    expect(test.db.operator.identity.find(operatorIdentity)?.role).toBe("operator");
  });

  it("supports authorized acknowledgment and forward-only status transitions", () => {
    const { test, owner } = createHarness();
    const customer = principal("customer");
    submit(test, customer);
    test.withReducerTx(owner, (ctx) => moduleExports.setIncidentStatus(ctx, {
      incidentId: validIncident.incidentId,
      status: "acknowledged",
    }));
    expect(test.db.incident.id.find(validIncident.incidentId)?.status).toBe("acknowledged");

    test.withReducerTx(owner, (ctx) => moduleExports.setIncidentStatus(ctx, {
      incidentId: validIncident.incidentId,
      status: "investigating",
    }));
    expect(() => test.withReducerTx(owner, (ctx) => moduleExports.setIncidentStatus(ctx, {
      incidentId: validIncident.incidentId,
      status: "fake_status",
    }))).toThrow("Unknown incident status");
    expect(() => test.withReducerTx(owner, (ctx) => moduleExports.setIncidentStatus(ctx, {
      incidentId: validIncident.incidentId,
      status: "submitted",
    }))).toThrow("Invalid incident status transition");
    expect(test.db.statusEvent.count()).toBe(3n);
  });
});

describe("sign-in and admin role", () => {
  function configured() {
    const harness = createHarness();
    harness.test.withReducerTx(harness.owner, (ctx) =>
      moduleExports.configureAuth(ctx, { issuer: CLERK_ISSUER, audience: "spacetimedb" }));
    return harness;
  }
  const connect = (test: Harness, auth: TestAuth) =>
    test.withReducerTx(auth, (ctx) => moduleExports.onConnect(ctx, {}));
  const roleOf = (test: Harness, auth: TestAuth) =>
    test.db.operator.identity.find(test.viewContext(auth).sender)?.role;

  it("only the owner can choose which identity provider to trust", () => {
    const { test } = createHarness();
    expect(() => test.withReducerTx(clerkUser("mallory"), (ctx) =>
      moduleExports.configureAuth(ctx, { issuer: CLERK_ISSUER, audience: "" })))
      .toThrow("Only the database owner can configure sign-in");
    const { test: t2, owner } = createHarness();
    expect(() => t2.withReducerTx(owner, (ctx) =>
      moduleExports.configureAuth(ctx, { issuer: "http://insecure.example/path", audience: "" })))
      .toThrow("Issuer must be an https URL");
  });

  it("makes a signed-in admin an operator on connect, and nobody else", () => {
    const { test } = configured();
    const admin = clerkUser("user_admin", { role: "admin" });
    const customer = clerkUser("user_customer");
    connect(test, admin);
    connect(test, customer);
    expect(roleOf(test, admin)).toBe("admin");
    expect(roleOf(test, customer)).toBeUndefined();
  });

  it("ignores an admin claim from an untrusted issuer or audience", () => {
    const { test } = configured();
    const forgedIssuer = clerkUser("user_x", { role: "admin" }, "https://attacker.example");
    const wrongAudience = TestAuth.fromJwtPayload(
      JSON.stringify({ sub: "user_y", iss: CLERK_ISSUER, aud: "some-other-app", role: "admin" }),
      new ConnectionId(connectionSequence++),
    );
    connect(test, forgedIssuer);
    connect(test, wrongAudience);
    expect(roleOf(test, forgedIssuer)).toBeUndefined();
    expect(roleOf(test, wrongAudience)).toBeUndefined();
  });

  it("removes admin access once the role is taken away in the provider", () => {
    const { test } = configured();
    connect(test, clerkUser("user_admin", { role: "admin" }));
    const demoted = clerkUser("user_admin");
    connect(test, demoted);
    expect(roleOf(test, demoted)).toBeUndefined();
  });

  it("never demotes the owner or a CLI-granted operator", () => {
    const { test, owner } = configured();
    const operatorAuth = clerkUser("user_operator");
    test.withReducerTx(owner, (ctx) =>
      moduleExports.grantOperator(ctx, { identity: test.viewContext(operatorAuth).sender }));
    connect(test, operatorAuth);
    connect(test, owner);
    expect(roleOf(test, operatorAuth)).toBe("operator");
    expect(roleOf(test, owner)).toBe("owner");
  });

  it("lets an admin see and work every incident, while customers see only their own", () => {
    const { test } = configured();
    const admin = clerkUser("user_admin", { role: "admin" });
    const alice = clerkUser("user_alice");
    const bob = clerkUser("user_bob");
    connect(test, admin);
    submit(test, alice);
    submit(test, bob, { ...validIncident, incidentId: "223e4567-e89b-42d3-a456-426614174000" });

    const adminRows = test.runQuery<{ id: string }>(moduleExports.operatorIncidents(test.viewContext(admin)));
    expect(adminRows).toHaveLength(2);
    expect(moduleExports.myIncidents(test.viewContext(alice)).map((r) => r.id)).toEqual([validIncident.incidentId]);
    expect(test.runQuery(moduleExports.operatorIncidents(test.viewContext(alice)))).toHaveLength(0);

    test.withReducerTx(admin, (ctx) =>
      moduleExports.setIncidentStatus(ctx, { incidentId: validIncident.incidentId, status: "acknowledged" }));
    expect(test.db.incident.id.find(validIncident.incidentId)?.status).toBe("acknowledged");
    expect(() => test.withReducerTx(bob, (ctx) =>
      moduleExports.setIncidentStatus(ctx, { incidentId: validIncident.incidentId, status: "resolved" })))
      .toThrow("Operator authorization required");
  });

  it("requires a trusted sign-in to report once sign-in is configured", () => {
    const { test } = configured();
    expect(() => submit(test, principal("anonymous"))).toThrow("Sign in to report an incident");
    submit(test, clerkUser("user_alice"));
    expect(test.db.incident.count()).toBe(1n);
  });

  it("tells each person only their own role", () => {
    const { test } = configured();
    const admin = clerkUser("user_admin", { role: "admin" });
    const customer = clerkUser("user_customer");
    connect(test, admin);
    expect(moduleExports.myRole(test.viewContext(admin)).map((r) => r.role)).toEqual(["admin"]);
    expect(moduleExports.myRole(test.viewContext(customer))).toEqual([]);
  });

  it("trusts several providers at once, including a proxied production issuer", () => {
    const { test, owner } = createHarness();
    const PROD = "https://interlock-comm.vercel.app/__clerk";
    test.withReducerTx(owner, (ctx) => moduleExports.trustIssuer(ctx, { issuer: CLERK_ISSUER, audience: "spacetimedb" }));
    test.withReducerTx(owner, (ctx) => moduleExports.trustIssuer(ctx, { issuer: PROD, audience: "spacetimedb" }));
    const devAdmin = clerkUser("user_dev", { role: "admin" });
    const prodAdmin = clerkUser("user_prod", { role: "admin" }, PROD);
    connect(test, devAdmin);
    connect(test, prodAdmin);
    expect(roleOf(test, devAdmin)).toBe("admin");
    expect(roleOf(test, prodAdmin)).toBe("admin");

    submit(test, clerkUser("user_prod_customer", {}, PROD));
    expect(() => submit(test, principal("anonymous"), { ...validIncident, incidentId: "323e4567-e89b-42d3-a456-426614174000" }))
      .toThrow("Sign in to report an incident");

    test.withReducerTx(owner, (ctx) => moduleExports.untrustIssuer(ctx, { issuer: PROD }));
    const afterRemoval = clerkUser("user_prod2", { role: "admin" }, PROD);
    connect(test, afterRemoval);
    expect(roleOf(test, afterRemoval)).toBeUndefined();
  });

  it("rejects malformed issuers and non-owners", () => {
    const { test, owner } = createHarness();
    for (const bad of ["http://x.example", "https://x.example/", "https://x.example/a?b=1", "not a url"]) {
      expect(() => test.withReducerTx(owner, (ctx) => moduleExports.trustIssuer(ctx, { issuer: bad, audience: "" })))
        .toThrow("Issuer must be an https URL");
    }
    expect(() => test.withReducerTx(clerkUser("mallory"), (ctx) =>
      moduleExports.trustIssuer(ctx, { issuer: CLERK_ISSUER, audience: "" })))
      .toThrow("Only the database owner can configure sign-in");
  });
});
