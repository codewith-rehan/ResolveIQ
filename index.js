
import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, timingSafeEqual } from "node:crypto";

import { analyzeComplaint } from "./ai.js";
import { runInvestigation } from "./agent.js";

const app = express();
const PORT = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const CASES_FILE = path.join(DATA_DIR, "cases.json");

app.use(cors());
app.use(express.json({ limit: "50kb" }));

async function readCases() {
  try {
    const content = await fs.readFile(CASES_FILE, "utf8");
    const cases = JSON.parse(content);
    return Array.isArray(cases) ? cases : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(CASES_FILE, "[]", "utf8");
      return [];
    }
    throw error;
  }
}

async function saveCases(cases) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const temporaryFile = `${CASES_FILE}.tmp`;

  await fs.writeFile(
    temporaryFile,
    JSON.stringify(cases, null, 2),
    "utf8"
  );

  await fs.rename(temporaryFile, CASES_FILE);
}

function normalizeAnalysis(analysis) {
  return {
    category: analysis.category || "General inquiry",
    priority: analysis.priority || "Normal",
    sentiment: analysis.sentiment || "Neutral",
    recommendation: analysis.recommendation || "Review the complaint.",
    reason: analysis.reason || "",
    customerReply: analysis.customerReply || "",
    provider: analysis.provider || "Local demonstration rules",
    isRealAI: analysis.isRealAI === true,
    isUncertain: analysis.isUncertain === true,
    confidence: analysis.confidence ?? null,
    reviewReason: analysis.reviewReason || "",
    detectedCategories: Array.isArray(analysis.detectedCategories)
      ? analysis.detectedCategories
      : [],
    requiresHumanReview: true,
    investigation: analysis.investigation || null
  };
}

function createActivity(action) {
  return {
    id: randomUUID(),
    action,
    timestamp: new Date().toISOString()
  };
}

function getCaseStatus(item) {
  if (item.decision === "approved" || item.status === "Approved") {
    return "Approved";
  }

  if (item.decision === "rejected" || item.status === "Rejected") {
    return "Rejected";
  }

  return "Pending review";
}

function isValidClearPassword(supplied, expected) {
  if (
    typeof supplied !== "string" ||
    typeof expected !== "string" ||
    !supplied ||
    !expected
  ) {
    return false;
  }

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);

  if (suppliedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(suppliedBuffer, expectedBuffer);
}

// Backend health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "ResolveIQ",
    status: "online",
    environment: "local demonstration",
    message: "ResolveIQ backend is running."
  });
});

// Analyze a customer complaint
app.post("/api/analyze", async (req, res, next) => {
  try {
    const complaint = String(req.body?.complaint || "").trim();

    if (!complaint) {
      return res.status(400).json({
        success: false,
        message: "Please enter a customer complaint."
      });
    }

    if (complaint.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "The complaint must be 5000 characters or fewer."
      });
    }

    const initialAnalysis = await analyzeComplaint(complaint);
    const investigation = await runInvestigation(
      complaint,
      initialAnalysis
    );

    const analysis = normalizeAnalysis({
      ...initialAnalysis,
      investigation
    });

    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    next(error);
  }
});

// Save a new case
app.post("/api/cases", async (req, res, next) => {
  try {
    const complaint = String(req.body?.complaint || "").trim();
    const suppliedAnalysis = req.body?.analysis;

    if (!complaint || !suppliedAnalysis) {
      return res.status(400).json({
        success: false,
        error: "Complaint and assessment are required."
      });
    }

    const cases = await readCases();
    const now = new Date().toISOString();

    const newCase = {
      id: `CASE-${randomUUID().slice(0, 8).toUpperCase()}`,
      complaint,
      analysis: normalizeAnalysis(suppliedAnalysis),
      status: "Pending review",
      decision: null,
      createdAt: now,
      updatedAt: now,
      activity: [
        createActivity("Customer complaint received."),
        createActivity("Preliminary assessment generated."),
        createActivity("Case saved for human review.")
      ]
    };

    cases.push(newCase);
    await saveCases(cases);

    return res.status(201).json({
      success: true,
      case: newCase
    });
  } catch (error) {
    next(error);
  }
});

// Get all cases
app.get("/api/cases", async (req, res, next) => {
  try {
    const cases = await readCases();

    return res.json({
      success: true,
      total: cases.length,
      cases
    });
  } catch (error) {
    next(error);
  }
});

// Clear all saved cases - password protected
app.delete("/api/cases", async (req, res, next) => {
  try {
    const expectedPassword = process.env.CLEAR_CASES_PASSWORD;
    const suppliedPassword = req.get("x-clear-password");

    if (!expectedPassword) {
      return res.status(503).json({
        success: false,
        error: "Case deletion is not configured on the server."
      });
    }

    if (!isValidClearPassword(suppliedPassword, expectedPassword)) {
      return res.status(401).json({
        success: false,
        error: "Incorrect password. Cases were not deleted."
      });
    }

    const existingCases = await readCases();
    const deletedCount = existingCases.length;

    await saveCases([]);

    return res.json({
      success: true,
      message: "All saved cases have been cleared.",
      deletedCount
    });
  } catch (error) {
    next(error);
  }
});

// Dashboard metrics
app.get("/api/metrics", async (req, res, next) => {
  try {
    const cases = await readCases();

    const pending = cases.filter(
      item => getCaseStatus(item) === "Pending review"
    );

    const approved = cases.filter(
      item => getCaseStatus(item) === "Approved"
    );

    const rejected = cases.filter(
      item => getCaseStatus(item) === "Rejected"
    );

    const uncertain = pending.filter(
      item => item.analysis?.isUncertain === true
    );

    const highPriority = pending.filter(
      item =>
        String(item.analysis?.priority || "").toLowerCase() === "high"
    );

    return res.json({
      success: true,
      metrics: {
        total: cases.length,
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        uncertain: uncertain.length,
        highPriority: highPriority.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get one case
app.get("/api/cases/:id", async (req, res, next) => {
  try {
    const cases = await readCases();
    const item = cases.find(entry => entry.id === req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Case not found."
      });
    }

    return res.json({
      success: true,
      case: item
    });
  } catch (error) {
    next(error);
  }
});

// Record a human decision
app.post("/api/cases/:id/decision", async (req, res, next) => {
  try {
    const decision = String(req.body?.decision || "").toLowerCase();
    const confirmUncertain = req.body?.confirmUncertain === true;

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: "Decision must be approved or rejected."
      });
    }

    const cases = await readCases();
    const index = cases.findIndex(
      item => item.id === req.params.id
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "Case not found."
      });
    }

    const item = cases[index];

    if (getCaseStatus(item) !== "Pending review") {
      return res.status(409).json({
        success: false,
        error: "This case already has a recorded decision."
      });
    }

    if (
      decision === "approved" &&
      item.analysis?.isUncertain === true &&
      !confirmUncertain
    ) {
      return res.status(400).json({
        success: false,
        error: "Human confirmation is required for uncertain assessments."
      });
    }

    const now = new Date().toISOString();

    item.decision = decision;
    item.status = decision === "approved" ? "Approved" : "Rejected";
    item.updatedAt = now;

    if (!Array.isArray(item.activity)) {
      item.activity = [];
    }

    item.activity.push(
      createActivity(
        decision === "approved"
          ? "Human approval recorded."
          : "Human rejection recorded."
      )
    );

    cases[index] = item;
    await saveCases(cases);

    return res.json({
      success: true,
      case: item
    });
  } catch (error) {
    next(error);
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error("ResolveIQ backend error:", error);

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON request."
    });
  }

  return res.status(500).json({
    success: false,
    error: "An unexpected backend error occurred."
  });
});

async function startServer() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  app.listen(PORT, () => {
    console.log(
      `ResolveIQ backend running at http://localhost:${PORT}`
    );
  });
}

startServer().catch(error => {
  console.error("Could not start ResolveIQ backend:", error);
  process.exit(1);
});
