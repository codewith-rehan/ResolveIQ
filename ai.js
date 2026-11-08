const containsAny = (text, keywords) =>
  keywords.some((keyword) => text.includes(keyword));

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function isNegated(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `\\b(?:not|never|isn't|wasn't|aren't|don't|doesn't|didn't)\\s+(?:\\w+\\s+){0,2}${escaped}\\b`,
    "i"
  );

  return pattern.test(text);
}

function detectSentiment(text) {
  const negativeWords = [
    "angry",
    "frustrated",
    "frustrating",
    "disappointed",
    "unacceptable",
    "terrible",
    "poor service",
    "very upset",
    "upset",
    "annoyed",
    "ridiculous",
    "worst experience",
    "not happy",
    "extremely upset",
    "horrible",
    "very disappointed",
    "fed up",
    "unhappy",
    "bad experience",
    "awful",
    "furious",
    "irritated",
    "dissatisfied",
    "let down",
    "waste of time",
    "extremely frustrating",
    "really frustrating",
    "so frustrating",
    "very frustrating",
    "this is frustrating",
    "disgusted",
    "poor experience"
  ];

  const positiveWords = [
    "thank you",
    "happy",
    "satisfied",
    "excellent service",
    "great service",
    "appreciate",
    "wonderful",
    "very helpful",
    "fantastic",
    "brilliant",
    "pleased",
    "awesome",
    "good experience",
    "well done",
    "great job"
  ];

  let negativeScore = 0;
  let positiveScore = 0;

  for (const phrase of negativeWords) {
    if (text.includes(phrase) && !isNegated(text, phrase)) {
      negativeScore += phrase.includes(" ") ? 2 : 1;
    }
  }

  for (const phrase of positiveWords) {
    if (text.includes(phrase) && !isNegated(text, phrase)) {
      positiveScore += phrase.includes(" ") ? 2 : 1;
    }
  }

  // Strong emotional language increases the sentiment score.
  if (
    containsAny(text, [
      "extremely",
      "absolutely",
      "completely",
      "really",
      "very",
      "so "
    ]) &&
    negativeScore > 0
  ) {
    negativeScore += 1;
  }

  if (negativeScore > positiveScore) {
    return "Frustrated";
  }

  if (positiveScore > negativeScore) {
    return "Positive";
  }

  return "Neutral";
}

const categories = [
  {
    name: "Duplicate payment",
    type: "issue",
    keywords: [
      "charged twice",
      "double charged",
      "charged three times",
      "duplicate payment",
      "duplicate charge",
      "charged more than once",
      "multiple charges",
      "charged two times",
      "same payment twice",
      "charged multiple times"
    ],
    recommendation:
      "Review payment records and verify whether a duplicate charge occurred.",
    reason:
      "The customer reports being charged more than once.",
    reply:
      "We're sorry for the inconvenience. Our team will review your payment records and help clarify the charges."
  },
  {
    name: "Missing item",
    type: "issue",
    keywords: [
      "missing item",
      "item missing",
      "item is missing",
      "items are missing",
      "one item is missing",
      "is missing from",
      "not included",
      "was not included",
      "wasn't included",
      "left out of my order",
      "missing from my order",
      "not in the package",
      "not in my package",
      "package is incomplete",
      "incomplete order",
      "part of my order is missing"
    ],
    recommendation:
      "Compare the order details with the packing and dispatch records.",
    reason:
      "The customer reports that an item was missing from the order.",
    reply:
      "We're sorry an item was missing from your order. We'll review the order details and investigate."
  },
  {
    name: "Wrong item received",
    type: "issue",
    keywords: [
      "wrong item",
      "incorrect item",
      "wrong product",
      "different product",
      "received the wrong",
      "sent the wrong",
      "not what i ordered",
      "different from what i ordered",
      "incorrect product",
      "wrong size sent",
      "wrong color sent"
    ],
    recommendation:
      "Verify the ordered product against the item delivered and review the exchange policy.",
    reason:
      "The customer reports receiving an item different from the one ordered.",
    reply:
      "We're sorry you received the wrong item. Please share your order details so our team can review the issue."
  },
  {
    name: "Damaged product",
    type: "issue",
    keywords: [
      "damaged",
      "broken",
      "cracked",
      "arrived defective",
      "arrived damaged",
      "package was damaged",
      "product is broken",
      "item is broken",
      "product arrived broken",
      "arrived in bad condition",
      "damaged during delivery",
      "parts are broken"
    ],
    recommendation:
      "Request relevant order evidence and review the replacement or refund policy.",
    reason:
      "The customer reports that the delivered product arrived damaged.",
    reply:
      "We're sorry your order arrived damaged. Please share the relevant order details so our team can review the issue."
  },
  {
    name: "Product quality issue",
    type: "issue",
    keywords: [
      "poor quality",
      "low quality",
      "quality issue",
      "not as described",
      "not working properly",
      "defective",
      "stopped working",
      "bad quality",
      "does not work",
      "doesn't work",
      "not functioning",
      "faulty product",
      "product malfunction",
      "quality is bad"
    ],
    recommendation:
      "Review the product details and customer evidence against the product quality policy.",
    reason:
      "The customer reports a product quality or description issue.",
    reply:
      "We're sorry the product did not meet your expectations. We'll review the details and help with the next steps."
  },
  {
    name: "Delivery issue",
    type: "issue",
    keywords: [
      "late delivery",
      "delivery is late",
      "delayed",
      "not arrived",
      "hasn't arrived",
      "has not arrived",
      "not received",
      "where is my order",
      "tracking",
      "delivery date",
      "not updated",
      "still waiting for my order",
      "delivery is delayed",
      "package is delayed",
      "parcel hasn't arrived",
      "parcel has not arrived",
      "order is taking too long"
    ],
    recommendation:
      "Check shipment tracking and confirm the delivery status with the carrier.",
    reason:
      "The customer reports a delivery delay or tracking issue.",
    reply:
      "We're sorry your order hasn't arrived as expected. We'll review the shipment information and help you with the next steps."
  },
  {
    name: "Payment failure",
    type: "issue",
    keywords: [
      "payment failed",
      "payment failure",
      "payment declined",
      "payment was declined",
      "my payment was declined",
      "my card was declined",
      "card was declined",
      "card declined",
      "couldn't pay",
      "could not pay",
      "unable to pay",
      "transaction failed",
      "payment not working",
      "payment didn't go through",
      "payment did not go through",
      "payment unsuccessful",
      "failed transaction",
      "payment error",
      "payment won't go through",
      "unable to complete payment"
    ],
    recommendation:
      "Review the payment transaction status and check for any failed or pending charges.",
    reason:
      "The customer reports that a payment could not be completed.",
    reply:
      "We're sorry you're experiencing a payment issue. We'll review the transaction status and help clarify what happened."
  },
  {
    name: "Account issue",
    type: "issue",
    keywords: [
      "login",
      "log in",
      "sign in",
      "locked account",
      "account access",
      "can't access my account",
      "cannot access my account",
      "forgot password",
      "password reset",
      "account is locked",
      "unable to log in",
      "unable to sign in",
      "can't log in",
      "cannot log in"
    ],
    recommendation:
      "Review the account access issue and follow the approved account recovery process.",
    reason:
      "The customer reports difficulty accessing their account.",
    reply:
      "We're sorry you're having trouble accessing your account. Our team will review the issue and guide you through the next steps."
  },
  {
    name: "Product information",
    type: "inquiry",
    keywords: [
      "product details",
      "product information",
      "available in",
      "do you have",
      "what size",
      "what color",
      "more information about",
      "is this available",
      "product specifications",
      "tell me about this product"
    ],
    recommendation:
      "Check the product information and provide the customer with accurate details.",
    reason:
      "The customer is requesting additional product information.",
    reply:
      "Thank you for your interest. We'll review the product details and provide the information you need."
  },
  {
    name: "Order status inquiry",
    type: "inquiry",
    keywords: [
      "order status",
      "check my order",
      "update on my order",
      "order confirmation",
      "has my order been processed",
      "where is my order status",
      "order progress"
    ],
    recommendation:
      "Review the order record and provide the latest confirmed order status.",
    reason:
      "The customer is requesting an update about their order.",
    reply:
      "Thank you for contacting us. We'll check your order record and provide an update."
  },
  {
    name: "Refund request",
    type: "request",
    keywords: [
      "refund",
      "money back",
      "return my money",
      "want my money back",
      "request a refund",
      "give me my money back",
      "get a refund",
      "need my money back"
    ],
    recommendation:
      "Review the order and applicable refund policy before making a decision.",
    reason:
      "The customer is requesting their money back.",
    reply:
      "Thank you for contacting us about your refund. We'll review your order and the applicable policy."
  },
  {
    name: "Cancellation request",
    type: "request",
    keywords: [
      "cancel my order",
      "cancel the order",
      "cancellation",
      "want to cancel",
      "please cancel",
      "cancel this order",
      "cancel my purchase"
    ],
    recommendation:
      "Check the order status and cancellation policy.",
    reason:
      "The customer is requesting an order cancellation.",
    reply:
      "Thank you for contacting us. We'll check your order status and review the cancellation options."
  }
];

export function analyzeComplaint(complaint) {
  const text = normalizeText(complaint);

  if (!text) {
    return {
      provider: "Local demo rules",
      isRealAI: false,
      category: "General inquiry",
      priority: "Normal",
      sentiment: "Neutral",
      recommendation: "Enter a complaint before running an assessment.",
      reason: "No complaint text was provided.",
      customerReply: "",
      requiresHumanReview: true,
      isUncertain: true,
      confidence: "Needs review",
      confidenceScore: 0,
      reviewReason: "The complaint is empty.",
      detectedCategories: []
    };
  }

  // 1. Sentiment
  const sentiment = detectSentiment(text);

  // 2. Default assessment
  let priority = "Normal";
  let category = "General inquiry";

  let recommendation =
    "Review the complaint and check the relevant business policy.";

  let reason =
    "The complaint does not clearly match a supported category. Further review is needed.";

  let customerReply =
    "Thank you for contacting us. Our team will review your message and get back to you.";

  let isUncertain = false;
  let reviewReason = "Human review is required before taking action.";

  // 3. Match complaint categories
  const matchedCategories = categories.filter((item) =>
    containsAny(text, item.keywords)
  );

  const issueMatches = matchedCategories.filter(
    (item) => item.type === "issue"
  );

  const requestMatches = matchedCategories.filter(
    (item) => item.type === "request"
  );

  const inquiryMatches = matchedCategories.filter(
    (item) => item.type === "inquiry"
  );

  let selectedCategory = null;

  // Multiple different problems need human clarification.
  if (issueMatches.length > 1) {
    category = "Multiple issues";
    isUncertain = true;

    recommendation =
      "Multiple potential issues were detected. Review each reported problem separately before recommending a resolution.";

    reason =
      "The customer may be reporting more than one issue. Human review is needed to identify the correct resolution.";

    customerReply =
      "Thank you for explaining the issues. Our team will review each concern and get back to you with the appropriate next steps.";

    reviewReason =
      "Multiple complaint categories matched. The main issue needs human confirmation.";

  } else if (issueMatches.length === 1) {
    selectedCategory = issueMatches[0];

  } else if (requestMatches.length === 1) {
    selectedCategory = requestMatches[0];

  } else if (requestMatches.length > 1) {
    isUncertain = true;

    recommendation =
      "Multiple customer requests were detected. Review the customer's intended request before proceeding.";

    reason =
      "The customer appears to be making more than one request. Further clarification is needed.";

    customerReply =
      "Thank you for contacting us. Could you clarify which request you would like our team to address first?";

    reviewReason =
      "Multiple request categories matched. The intended resolution needs confirmation.";

  } else if (inquiryMatches.length === 1) {
    selectedCategory = inquiryMatches[0];

  } else {
    isUncertain = true;

    recommendation =
      "Review the customer's message and request clarification before recommending a resolution.";

    reason =
      "The complaint does not clearly match a supported category.";

    customerReply =
      "Thank you for contacting us. Could you provide a little more detail about the issue so our team can assist you correctly?";

    reviewReason =
      "No clear complaint category was identified. Human review or customer clarification is needed.";
  }

  // 4. Apply selected category
  if (selectedCategory) {
    category = selectedCategory.name;
    recommendation = selectedCategory.recommendation;
    reason = selectedCategory.reason;
    customerReply = selectedCategory.reply;
  }

  // 5. Priority detection
  const highPriorityWords = [
    "urgent",
    "urgently",
    "immediately",
    "as soon as possible",
    "serious issue",
    "multiple charges",
    "charged twice",
    "double charged",
    "charged three times",
    "account locked",
    "cannot access my account",
    "can't access my account",
    "very important",
    "critical issue",
    "need this resolved today",
    "need it resolved today",
    "today",
    "emergency",
    "time sensitive",
    "time-sensitive",
    "business is stopped",
    "unable to operate"
  ];

  const lowPriorityWords = [
    "whenever possible",
    "not urgent",
    "just checking",
    "no rush",
    "when convenient",
    "when you have time"
  ];

  // High urgency takes precedence over low urgency.
  if (containsAny(text, highPriorityWords)) {
    priority = "High";
  } else if (containsAny(text, lowPriorityWords)) {
    priority = "Low";
  }

  // 6. Assessment confidence
  // This is a rule-based indicator, not a machine-learning probability.
  let confidenceScore = 0;

  if (selectedCategory) {
    confidenceScore = 80;
  }

  if (matchedCategories.length > 1) {
    confidenceScore = 55;
  }

  if (isUncertain) {
    confidenceScore = 35;
  }

  if (selectedCategory && sentiment !== "Neutral") {
    confidenceScore = Math.min(confidenceScore + 5, 90);
  }

  const confidence = isUncertain
    ? "Needs review"
    : confidenceScore >= 80
      ? "Strong rule match"
      : "Rule match";

  // 7. Final result
  return {
    provider: "Local demo rules",
    isRealAI: false,

    category,
    priority,
    sentiment,

    recommendation,
    reason,
    customerReply,

    requiresHumanReview: true,

    isUncertain,
    confidence,
    confidenceScore,
    reviewReason,

    detectedCategories: matchedCategories.map(
      (item) => item.name
    )
  };
}