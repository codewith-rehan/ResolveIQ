
// ResolveIQ Local Investigation Engine
// Runs without Gemini API calls.
// All records below are simulated demonstration data.

const demoRecords = {
  order: {
    orderId: "ORD-1042",
    status: "Delivered",
    item: "Wireless Headphones",
    deliveryDate: "2026-11-06",
  },

  payment: {
    transactionId: "TXN-8821",
    status: "Completed",
    amount: 49.99,
    currency: "USD",
  },

  delivery: {
    trackingId: "TRK-5501",
    status: "Delivered",
    lastUpdate: "2026-11-06",
  },
};

const investigationTools = [
  {
    name: "getOrderDetails",
    label: "Order Details",
    execute: () => demoRecords.order,
  },
  {
    name: "getPaymentDetails",
    label: "Payment Details",
    execute: () => demoRecords.payment,
  },
  {
    name: "getDeliveryStatus",
    label: "Delivery Status",
    execute: () => demoRecords.delivery,
  },
];

function cleanText(value) {
  return String(value || "").trim().slice(0, 3000);
}

function buildSummary(complaint, assessment, results) {
  const order = results.getOrderDetails;
  const payment = results.getPaymentDetails;
  const delivery = results.getDeliveryStatus;

  const priority = assessment?.priority || "Normal";
  const category = assessment?.category || "General inquiry";

  return [
    "RESOLVEIQ INVESTIGATION REPORT",
    "",
    `Customer complaint: ${complaint}`,
    "",
    "INITIAL CASE ASSESSMENT",
    `Category: ${category}`,
    `Priority: ${priority}`,
    "",
    "INVESTIGATION FINDINGS",
    "",
    `1. Order Details: Order ${order.orderId} is listed as ${order.status}. The recorded item is ${order.item}, with a delivery date of ${order.deliveryDate}.`,
    "",
    `2. Payment Details: Transaction ${payment.transactionId} is listed as ${payment.status}. The recorded amount is ${payment.amount} ${payment.currency}.`,
    "",
    `3. Delivery Status: Tracking ${delivery.trackingId} is listed as ${delivery.status}. Its last recorded update is ${delivery.lastUpdate}.`,
    "",
    "VERIFICATION LIMITATION",
    "These findings come from predefined simulated demonstration records. They are not connected to a real order management, payment, or delivery platform.",
    "",
    "RECOMMENDATION",
    "A human reviewer should compare the complaint against verified business records, investigate any reported discrepancy, and decide the appropriate next action.",
  ].join("\n");
}

export async function runInvestigation(complaint, assessment = {}) {
  const cleanComplaint = cleanText(complaint);

  if (!cleanComplaint) {
    throw new Error("Cannot investigate an empty complaint.");
  }

  console.log("ResolveIQ: starting local investigation...");

  const toolCalls = [];
  const evidence = [];
  const results = {};

  // Execute all three investigation tools.
  for (const tool of investigationTools) {
    try {
      console.log(`ResolveIQ: executing ${tool.name}`);

      const result = tool.execute();

      results[tool.name] = result;

      toolCalls.push({
        tool: tool.name,
        label: tool.label,
        status: "completed",
        dataSource: "SIMULATED DATA",
        result,
      });

      evidence.push(
        `${tool.label}: demonstration record retrieved successfully.`
      );
    } catch (error) {
      toolCalls.push({
        tool: tool.name,
        label: tool.label,
        status: "failed",
        dataSource: "SIMULATED DATA",
        result: {
          error: error.message,
        },
      });

      evidence.push(
        `${tool.label}: retrieval failed. ${error.message}`
      );
    }
  }

  const successfulTools = toolCalls.filter(
    (call) => call.status === "completed"
  ).length;

  const summary = successfulTools === 3
    ? buildSummary(cleanComplaint, assessment, results)
    : "The investigation could not retrieve every demonstration record. Human review is required.";

  console.log(
    `ResolveIQ: investigation finished. ${successfulTools}/3 tools completed.`
  );

  return {
    agentName: "ResolveIQ Investigation Agent",

    investigationStatus:
      successfulTools === 3
        ? "Investigation completed"
        : "Investigation partially completed",

    provider: "Local Investigation Engine",

    isRealAI: false,

    summary,

    toolCalls,

    evidence,

    dataSource: "SIMULATED DATA",

    requiresHumanReview: true,

    nextStep:
      "A human reviewer must verify all findings against real business records before taking action.",
  };
}
