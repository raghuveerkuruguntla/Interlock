/**
 * Every word the customer reads, in every language Interlock supports.
 *
 * Two rules govern this file.
 *
 * 1. Fifth-grade reading level in the victim path. "Suspicious activity
 *    detected" is not a warning. "Nobody from your bank will ask for this
 *    code" is. Jargon is banned on customer-facing strings: not "SIM swap"
 *    but "someone is trying to move your phone number to a different phone".
 *
 * 2. Spanish is a first-class locale, not a translated banner over an English
 *    flow. Warnings, reasons, recovery checklists and the account-change
 *    interlock are all translated, because a half-translated recovery
 *    checklist is worse than none — it strands someone mid-panic.
 *
 * Scam losses fall heavily on people who get no protection at all from
 * English-only tooling. Two hours of work here is the highest-leverage
 * accessibility decision in the product.
 */

import type { ExposureKind, SignalId, Tier } from "./types";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

interface SafeguardCopy {
  title: string;
  body: string;
  action?: string;
  secondary?: string;
}

export interface CopyPack {
  signalLabels: Record<SignalId, string>;
  tierLabels: Record<Tier, string>;
  stageLabels: Record<string, string>;
  safeguards: {
    campaignMatch: SafeguardCopy;
    groundedWarning: SafeguardCopy;
    groundedWarningStrong: SafeguardCopy;
    abstainQuestion: SafeguardCopy;
    outOfBand: SafeguardCopy;
    channelMigration: SafeguardCopy;
    otpGuard: SafeguardCopy;
    remoteAccess: SafeguardCopy;
    circuitBreaker: SafeguardCopy;
    recoveryMode: SafeguardCopy;
  };
  accountActions: Record<string, { plain: string; consequence: string }>;
  exposures: Record<ExposureKind, string>;
  recoverySteps: Record<ExposureKind, string[]>;
  ui: Record<string, string>;
  /** What the attacker is doing at each stage, in the customer's language. */
  stageBlurb: Record<string, string>;
  /** Demo chrome. Translated too, so the Spanish flow is a flow and not a banner. */
  demo: Record<string, string>;
}

const EN: CopyPack = {
  signalLabels: {
    brand_claim: "Says it is from a company or agency you know",
    unverified_link: "Has a link we have not checked",
    time_pressure: "Pushes you to act fast",
    authority_threat: "Threatens arrest, fines or legal trouble",
    payment_link: "Asks you to pay through a link in the message",
    prize_or_refund: "Promises money back or a prize",
    secrecy_request: "Asks you to keep this secret",
    discourage_verification: "Tells you not to check with your bank or carrier",
    channel_migration: "Wants to move the chat to another app",
    callback_substitution: "Gives you a phone number to call back",
    relationship_grooming: "Builds a close personal bond quickly",
    secret_request: "Asks for a code, PIN or password",
    payment_data_request: "Asks for card or bank details",
    remote_access_request: "Asks to control your device",
    investment_enticement: "Offers an investment with promised returns",
    otp_during_call: "A code arrived while you were on a call",
    money_movement_request: "Asks you to send money",
    qr_or_voucher_payment: "Asks you to pay with a QR code, voucher or gift card",
    account_action_in_flight: "Someone is changing your account right now",
  },
  tierLabels: {
    none: "Nothing yet",
    low: "Worth a look",
    elevated: "Be careful",
    high: "Likely a scam",
    critical: "Stop now",
  },
  stageLabels: {
    contact: "First contact",
    hook: "The hook",
    isolation: "Cutting you off",
    escalation: "The ask",
    extraction: "Taking something",
    recovery: "Getting help",
  },
  safeguards: {
    campaignMatch: {
      title: "Other people got this exact message",
      body: "Someone reported this same message. We matched it without reading your text.",
      action: "See what people reported",
    },
    groundedWarning: {
      title: "Here is what we noticed",
      body: "We are not sure this is a scam. These are the things that stood out.",
      action: "Show me why",
    },
    groundedWarningStrong: {
      title: "Stop before you do anything else",
      body: "We have seen enough in this conversation to think someone is working on you right now.",
      action: "Show me why",
    },
    abstainQuestion: {
      title: "One question before you reply",
      body: "This message could go either way. Your answer tells us more than our score does.",
      action: "Answer",
    },
    outOfBand: {
      title: "Call the real number instead",
      body: "This message gave you a number to call. Scams work by handing you a fake way back to the company. Use the real one.",
      action: "Call the real number",
      secondary: "I already checked — this is real",
    },
    channelMigration: {
      title: "They want to move you to another app",
      body: "Moving the chat to WhatsApp or Telegram takes you somewhere nobody can help you. Real companies do not do this.",
    },
    otpGuard: {
      title: "You are on a call right now",
      body: "Nobody real will ask you to read this code out loud. Not your bank. Not your phone company. Not the police.",
      action: "Show the code anyway",
      secondary: "Keep it hidden",
    },
    remoteAccess: {
      title: "Do not let them control your phone",
      body: "Someone is asking to see or control your screen. Once they can, they can open your bank app as you.",
    },
    circuitBreaker: {
      title: "We are holding this for 10 minutes",
      body: "We are not stopping you. We are slowing this down so nobody can rush you.",
      action: "I understand — continue anyway",
      secondary: "Cancel this change",
    },
    recoveryMode: {
      title: "Think you were scammed?",
      body: "Press this and we lock your account first, then walk you through the rest. You do not need to explain anything yet.",
      action: "I think I was scammed",
    },
  },
  accountActions: {
    port_out: {
      plain: "Move your phone number to a different company",
      consequence: "Your phone will stop working and text codes will go to someone else.",
    },
    sim_swap: {
      plain: "Move your phone number to a different SIM card",
      consequence: "Your phone will stop working and text codes will go to someone else.",
    },
    autopay_change: {
      plain: "Change the card that pays your bill",
      consequence: "Your bill would be paid from a different account.",
    },
    add_authorized_user: {
      plain: "Let another person manage your account",
      consequence: "That person could change or cancel things without asking you.",
    },
    plan_change: {
      plain: "Change your plan",
      consequence: "What you pay each month would change.",
    },
    address_change: {
      plain: "Change the address on your account",
      consequence: "Mail and new devices would go somewhere else.",
    },
  },
  exposures: {
    carrier_otp: "A code from my phone company",
    credential: "A password or login",
    payment_card: "My card number",
    bank_transfer: "I sent money",
    device_access: "I let them onto my phone or computer",
    link_opened: "I opened a link",
    identity_document: "A photo or number from my ID",
    phone_number: "My phone number",
    other: "Something else",
  },
  recoverySteps: {
    carrier_otp: [
      "Do not share any more codes, even if they ask again.",
      "Open your phone company's own app yourself. Do not use a link anyone sent you.",
      "Ask them to turn on number-transfer protection and check for changes to your account.",
      "Check your email and bank accounts, because they use this phone number to let you back in.",
    ],
    credential: [
      "Open the real website yourself, using a bookmark or by typing the address.",
      "Change that password. If you used it anywhere else, change it there too.",
      "Sign out all other devices in the account settings.",
      "Check for new forwarding rules or recovery emails you did not add.",
    ],
    payment_card: [
      "Call your bank using the number printed on the back of your card.",
      "Ask them to lock or replace the card.",
      "Look at recent charges with them on the phone.",
      "Do not send a photo of the full card to anyone, including us.",
    ],
    bank_transfer: [
      "Call your bank's fraud line right now and ask them to try to recall the transfer.",
      "Write down the time and the reference number for the transfer.",
      "Report it to your bank in writing as well as on the phone.",
      "Money sent this way is often not recoverable. Acting in the first hours helps most.",
    ],
    device_access: [
      "End the screen sharing and turn your device off, then on again.",
      "Use a different device you trust to change your important passwords.",
      "Look through your installed apps and remove anything you did not add.",
      "Get help from someone you trust to check the device.",
    ],
    link_opened: [
      "Opening a link by itself usually does not mean you lost anything.",
      "Close the page. Do not type anything into it.",
      "If you entered a password there, change that password now.",
      "If you installed something, treat it like device access above.",
    ],
    identity_document: [
      "Consider freezing your credit with the main credit bureaus.",
      "Watch for new accounts opened in your name.",
      "Keep a copy of what you sent and when, but do not send it again.",
    ],
    phone_number: [
      "Be careful about any codes that arrive that you did not ask for.",
      "Ask your phone company to add number-transfer protection.",
    ],
    other: [
      "Do not share anything more with them.",
      "Write down what you think they got while it is fresh.",
      "Call the company involved using a number you looked up yourself.",
    ],
  },
  ui: {
    appName: "Interlock",
    tagline: "We watch the whole conversation, not just one message.",
    riskLabel: "Risk so far",
    stageLabel: "Where this is in the scam",
    whyLabel: "Why we are saying this",
    receiptLabel: "Decision receipt",
    observed: "What we looked at",
    notUsed: "What we did not look at",
    leftDevice: "What left your phone",
    appeal: "Think we got this wrong?",
    noEvidence: "Nothing to show yet. We will not guess.",
    insufficient: "Not enough to say either way",
    largeType: "Large type",
    language: "Language",
    verified: "You marked this sender as real. We lifted the holds.",
  },
  stageBlurb: {
    contact: "Someone got in touch. On its own this means nothing.",
    hook: "A story is being set up — a problem, a deadline, a link.",
    isolation: "They are trying to cut you off from anyone who would check.",
    escalation: "They are asking for the thing they actually came for.",
    extraction: "Something irreversible is being moved right now.",
    recovery: "Containing it and working out what to do next.",
  },
  demo: {
    messages: "Messages",
    callConnected: "Call connected",
    callEnded: "Call ended",
    verifiedRow: "You checked through a channel you trust",
    reportedRow: "You told us you may have shared something",
    verificationCode: "verification code",
    heldSeconds: "Held for 60 seconds. You are on a call right now.",
    showAnyway: "Show it anyway",
    demoValue: "Demo value. Never type a real code into this app.",
    accountChange: "Account change requested",
    yourNotes: "Your notes about the call",
    notesDisclaimer: "Your words. We never record calls, and only transcribe one during a live session you start.",
    composerPlaceholder: "Type a message as the sender…",
    composerLabel: "Type a message as the sender, to score it live",
    send: "Send",
    play: "Play",
    pause: "Pause",
    finished: "Finished",
    step: "Step",
    restart: "Restart",
    whatYouCanDo: "What you can do",
    verifyAction: "I checked through a channel I trust — this sender is real",
    verifyHint: "Cannot lower established scam risk or release an active passcode or account-change hold.",
    recoveryHint: "Works even if nothing above was flagged.",
    reportAction: "Report this to the network",
    reportSent: "Queued for simulated review",
    reportFailed: "Report failed — try again",
    safeguardsInPlay: "Safeguards in play",
    nothingFired:
      "Nothing has fired. At first contact a message is just a message, and we are not going to invent a verdict to fill the space.",
    exposureLegend: "What do you think you shared?",
    exposureNote:
      "We record the type only — never the value. Telling us this is a claim about possible exposure, not proof anything was taken.",
    composerNote:
      "Type anything — it is scored locally by the same model the evaluation page reports on. Never enter a real code, password or card number.",
    stageNote:
      "Stages can be skipped but never un-entered. A thread that reached one of these does not drop back because the next three messages are small talk.",
    typedLive: "Typed live",
  },
};

const ES: CopyPack = {
  signalLabels: {
    brand_claim: "Dice ser de una empresa o agencia que conoces",
    unverified_link: "Tiene un enlace que no hemos revisado",
    time_pressure: "Te apura a actuar rápido",
    authority_threat: "Amenaza con arresto, multas o problemas legales",
    payment_link: "Te pide pagar por un enlace del mensaje",
    prize_or_refund: "Promete dinero de vuelta o un premio",
    secrecy_request: "Te pide guardar el secreto",
    discourage_verification: "Te dice que no llames a tu banco ni a tu compañía",
    channel_migration: "Quiere mover la conversación a otra aplicación",
    callback_substitution: "Te da un número de teléfono para llamar",
    relationship_grooming: "Crea un vínculo personal muy rápido",
    secret_request: "Pide un código, PIN o contraseña",
    payment_data_request: "Pide datos de tarjeta o del banco",
    remote_access_request: "Pide controlar tu teléfono o computadora",
    investment_enticement: "Ofrece una inversión con ganancias prometidas",
    otp_during_call: "Llegó un código mientras estabas en una llamada",
    money_movement_request: "Te pide enviar dinero",
    qr_or_voucher_payment: "Te pide pagar con código QR, vale o tarjeta de regalo",
    account_action_in_flight: "Alguien está cambiando tu cuenta ahora mismo",
  },
  tierLabels: {
    none: "Nada todavía",
    low: "Vale la pena mirar",
    elevated: "Ten cuidado",
    high: "Probablemente es una estafa",
    critical: "Detente ahora",
  },
  stageLabels: {
    contact: "Primer contacto",
    hook: "El anzuelo",
    isolation: "Te están aislando",
    escalation: "La petición",
    extraction: "Te están quitando algo",
    recovery: "Buscar ayuda",
  },
  safeguards: {
    campaignMatch: {
      title: "Otras personas recibieron este mismo mensaje",
      body: "Alguien reportó este mismo mensaje. Lo reconocimos sin leer tu texto.",
      action: "Ver lo que reportaron",
    },
    groundedWarning: {
      title: "Esto es lo que notamos",
      body: "No estamos seguros de que sea una estafa. Estas son las cosas que llamaron la atención.",
      action: "Muéstrame por qué",
    },
    groundedWarningStrong: {
      title: "Detente antes de hacer cualquier otra cosa",
      body: "Hemos visto lo suficiente en esta conversación para pensar que alguien te está trabajando ahora mismo.",
      action: "Muéstrame por qué",
    },
    abstainQuestion: {
      title: "Una pregunta antes de responder",
      body: "Este mensaje podría ser cualquiera de las dos cosas. Tu respuesta nos dice más que nuestro puntaje.",
      action: "Responder",
    },
    outOfBand: {
      title: "Llama al número verdadero",
      body: "Este mensaje te dio un número para llamar. Las estafas funcionan dándote una vía falsa de regreso a la empresa. Usa la verdadera.",
      action: "Llamar al número verdadero",
      secondary: "Ya lo verifiqué — es real",
    },
    channelMigration: {
      title: "Quieren llevarte a otra aplicación",
      body: "Mover la conversación a WhatsApp o Telegram te lleva donde nadie puede ayudarte. Las empresas reales no hacen esto.",
    },
    otpGuard: {
      title: "Estás en una llamada ahora mismo",
      body: "Nadie real te pedirá que leas este código en voz alta. Ni tu banco. Ni tu compañía de teléfono. Ni la policía.",
      action: "Mostrar el código de todos modos",
      secondary: "Mantenerlo oculto",
    },
    remoteAccess: {
      title: "No dejes que controlen tu teléfono",
      body: "Alguien pide ver o controlar tu pantalla. Si lo logran, pueden abrir tu aplicación del banco como si fueran tú.",
    },
    circuitBreaker: {
      title: "Vamos a esperar 10 minutos",
      body: "No te estamos deteniendo. Estamos bajando la velocidad para que nadie te apure.",
      action: "Entiendo — continuar de todos modos",
      secondary: "Cancelar este cambio",
    },
    recoveryMode: {
      title: "¿Crees que te estafaron?",
      body: "Presiona aquí y primero protegemos tu cuenta, luego te guiamos. No tienes que explicar nada todavía.",
      action: "Creo que me estafaron",
    },
  },
  accountActions: {
    port_out: {
      plain: "Pasar tu número de teléfono a otra compañía",
      consequence: "Tu teléfono dejará de funcionar y los códigos por mensaje irán a otra persona.",
    },
    sim_swap: {
      plain: "Pasar tu número de teléfono a otra tarjeta SIM",
      consequence: "Tu teléfono dejará de funcionar y los códigos por mensaje irán a otra persona.",
    },
    autopay_change: {
      plain: "Cambiar la tarjeta que paga tu factura",
      consequence: "Tu factura se pagaría desde otra cuenta.",
    },
    add_authorized_user: {
      plain: "Dejar que otra persona maneje tu cuenta",
      consequence: "Esa persona podría cambiar o cancelar cosas sin preguntarte.",
    },
    plan_change: {
      plain: "Cambiar tu plan",
      consequence: "Lo que pagas cada mes cambiaría.",
    },
    address_change: {
      plain: "Cambiar la dirección de tu cuenta",
      consequence: "El correo y los equipos nuevos irían a otro lugar.",
    },
  },
  exposures: {
    carrier_otp: "Un código de mi compañía de teléfono",
    credential: "Una contraseña o inicio de sesión",
    payment_card: "El número de mi tarjeta",
    bank_transfer: "Envié dinero",
    device_access: "Los dejé entrar a mi teléfono o computadora",
    link_opened: "Abrí un enlace",
    identity_document: "Una foto o número de mi identificación",
    phone_number: "Mi número de teléfono",
    other: "Otra cosa",
  },
  recoverySteps: {
    carrier_otp: [
      "No compartas más códigos, aunque los vuelvan a pedir.",
      "Abre tú mismo la aplicación de tu compañía de teléfono. No uses un enlace que te hayan enviado.",
      "Pídeles que activen la protección de traspaso de número y que revisen los cambios en tu cuenta.",
      "Revisa tu correo y tus cuentas del banco, porque usan este número para dejarte entrar.",
    ],
    credential: [
      "Abre tú mismo el sitio verdadero, con un marcador o escribiendo la dirección.",
      "Cambia esa contraseña. Si la usaste en otro lado, cámbiala también ahí.",
      "Cierra la sesión en los demás dispositivos desde la configuración de la cuenta.",
      "Revisa si hay reglas de reenvío o correos de recuperación que tú no agregaste.",
    ],
    payment_card: [
      "Llama a tu banco al número impreso al reverso de tu tarjeta.",
      "Pide que bloqueen o reemplacen la tarjeta.",
      "Revisa con ellos los cargos recientes mientras estás en la llamada.",
      "No envíes una foto de la tarjeta completa a nadie, ni siquiera a nosotros.",
    ],
    bank_transfer: [
      "Llama ahora mismo a la línea de fraude de tu banco y pide que intenten recuperar la transferencia.",
      "Anota la hora y el número de referencia de la transferencia.",
      "Reporta el caso por escrito además de por teléfono.",
      "El dinero enviado así muchas veces no se recupera. Actuar en las primeras horas ayuda más.",
    ],
    device_access: [
      "Termina la sesión de pantalla compartida y apaga el aparato, luego enciéndelo otra vez.",
      "Usa otro aparato de confianza para cambiar tus contraseñas importantes.",
      "Revisa tus aplicaciones y quita lo que tú no instalaste.",
      "Pide ayuda a alguien de confianza para revisar el aparato.",
    ],
    link_opened: [
      "Abrir un enlace, por sí solo, casi nunca significa que perdiste algo.",
      "Cierra la página. No escribas nada en ella.",
      "Si escribiste una contraseña ahí, cámbiala ahora.",
      "Si instalaste algo, trátalo como el caso de acceso al aparato.",
    ],
    identity_document: [
      "Considera congelar tu crédito con las agencias principales.",
      "Vigila si abren cuentas nuevas a tu nombre.",
      "Guarda una copia de lo que enviaste y cuándo, pero no lo vuelvas a enviar.",
    ],
    phone_number: [
      "Ten cuidado con cualquier código que llegue sin que lo hayas pedido.",
      "Pide a tu compañía que agregue protección de traspaso de número.",
    ],
    other: [
      "No compartas nada más con ellos.",
      "Anota lo que crees que obtuvieron mientras lo recuerdas bien.",
      "Llama a la empresa usando un número que tú mismo hayas buscado.",
    ],
  },
  ui: {
    appName: "Interlock",
    tagline: "Miramos toda la conversación, no solo un mensaje.",
    riskLabel: "Riesgo hasta ahora",
    stageLabel: "En qué parte de la estafa va esto",
    whyLabel: "Por qué decimos esto",
    receiptLabel: "Recibo de decisión",
    observed: "Lo que miramos",
    notUsed: "Lo que no miramos",
    leftDevice: "Lo que salió de tu teléfono",
    appeal: "¿Crees que nos equivocamos?",
    noEvidence: "Todavía no hay nada que mostrar. No vamos a adivinar.",
    insufficient: "No hay suficiente para decidir",
    largeType: "Letra grande",
    language: "Idioma",
    verified: "Marcaste a este remitente como real. Quitamos las retenciones.",
  },
  stageBlurb: {
    contact: "Alguien se puso en contacto. Por sí solo esto no significa nada.",
    hook: "Están armando una historia — un problema, una fecha límite, un enlace.",
    isolation: "Están tratando de separarte de cualquiera que pudiera verificar.",
    escalation: "Están pidiendo lo que vinieron a buscar.",
    extraction: "Algo que no se puede deshacer se está moviendo ahora mismo.",
    recovery: "Contenerlo y decidir qué hacer a continuación.",
  },
  demo: {
    messages: "Mensajes",
    callConnected: "Llamada conectada",
    callEnded: "Llamada terminada",
    verifiedRow: "Verificaste por un canal en el que confías",
    reportedRow: "Nos dijiste que pudiste haber compartido algo",
    verificationCode: "código de verificación",
    heldSeconds: "Retenido por 60 segundos. Estás en una llamada ahora mismo.",
    showAnyway: "Mostrarlo de todos modos",
    demoValue: "Valor de demostración. Nunca escribas un código real en esta aplicación.",
    accountChange: "Cambio de cuenta solicitado",
    yourNotes: "Tus notas sobre la llamada",
    notesDisclaimer: "Tus palabras. Nunca grabamos llamadas y solo transcribimos durante una sesión en vivo que tú inicies.",
    composerPlaceholder: "Escribe un mensaje como si fueras quien envía…",
    composerLabel: "Escribe un mensaje como quien envía, para evaluarlo en vivo",
    send: "Enviar",
    play: "Reproducir",
    pause: "Pausar",
    finished: "Terminado",
    step: "Avanzar",
    restart: "Reiniciar",
    whatYouCanDo: "Lo que puedes hacer",
    verifyAction: "Verifiqué por un canal de confianza — este remitente es real",
    verifyHint: "No puede reducir un riesgo de estafa establecido ni quitar una retención activa de código o cambio de cuenta.",
    recoveryHint: "Funciona aunque no se haya marcado nada arriba.",
    reportAction: "Reportar esto a la red",
    reportSent: "En cola para revisión simulada",
    reportFailed: "El reporte falló — inténtalo de nuevo",
    safeguardsInPlay: "Protecciones activas",
    nothingFired:
      "No se activó nada. En el primer contacto un mensaje es solo un mensaje, y no vamos a inventar un veredicto para llenar el espacio.",
    exposureLegend: "¿Qué crees que compartiste?",
    exposureNote:
      "Solo registramos el tipo — nunca el valor. Decirnos esto es una declaración sobre una posible exposición, no una prueba de que se llevaron algo.",
    composerNote:
      "Escribe lo que quieras — se evalúa localmente con el mismo modelo que reporta la página de evidencia. Nunca ingreses un código, contraseña o número de tarjeta real.",
    stageNote:
      "Las etapas se pueden saltar pero nunca se deshacen. Una conversación que llegó a una de estas no retrocede porque los siguientes tres mensajes sean charla trivial.",
    typedLive: "Escrito en vivo",
  },
};

const PACKS: Record<Locale, CopyPack> = { en: EN, es: ES };

export function copyFor(locale: Locale): CopyPack {
  return PACKS[locale] ?? EN;
}
