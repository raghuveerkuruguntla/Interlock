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