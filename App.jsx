
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "https://x619qcr8-3001.inc1.devtunnels.ms";

async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    throw new Error("The backend returned an invalid response.");
  }
}

function getInvestigationConflicts(complaint, investigation) {
  if (!investigation || !Array.isArray(investigation.toolCalls)) return [];

  const text = String(complaint || "").toLowerCase();
  const conflicts = [];

  const deliveryTool = investigation.toolCalls.find(
    tool => tool.tool === "getDeliveryStatus"
  );
  const orderTool = investigation.toolCalls.find(
    tool => tool.tool === "getOrderDetails"
  );

  const saysNotDelivered =
    /not arrived|hasn't arrived|has not arrived|never arrived|not received|haven't received|have not received|still waiting|not delivered/.test(text);

  const deliveryStatus = String(deliveryTool?.result?.status || "").toLowerCase();
  const orderStatus = String(orderTool?.result?.status || "").toLowerCase();

  if (
    saysNotDelivered &&
    (deliveryStatus === "delivered" || orderStatus === "delivered")
  ) {
    conflicts.push({
      title: "Delivery status discrepancy",
      description:
        "The customer reports that the order has not arrived, but the simulated business record says it was delivered. The actual delivery must be verified.",
      severity: "warning"
    });
  }

  return conflicts;
}

function App() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [complaint, setComplaint] = useState("");
  const [analyzedComplaint, setAnalyzedComplaint] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [confirmationCaseId, setConfirmationCaseId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");

  // Clear All Cases
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [clearError, setClearError] = useState("");
  const [clearingCases, setClearingCases] = useState(false);

  const navItems = [
    { label: "Overview", icon: "⌂" },
    { label: "Case Analyzer", icon: "⌕" },
    { label: "Case History", icon: "◷" },
    { label: "Approvals", icon: "✓" }
  ];

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const loadCases = async (showError = true) => {
    try {
      const response = await fetch(`${API_URL}/api/cases`);
      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not load saved cases.");
      }

      setCases(Array.isArray(data.cases) ? data.cases : []);
      setError("");
      return true;
    } catch (err) {
      if (showError) {
        setError(
          err.message ||
          "Cannot connect to the backend. Check that Terminal 1 is running."
        );
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const getStatus = (item) => {
    if (item.decision === "approved" || item.status === "Approved") return "Approved";
    if (item.decision === "rejected" || item.status === "Rejected") return "Rejected";
    return "Pending review";
  };

  const isPending = (item) => getStatus(item) === "Pending review";

  const pendingCases = cases.filter(isPending);
  const approvedCases = cases.filter(item => getStatus(item) === "Approved");
  const rejectedCases = cases.filter(item => getStatus(item) === "Rejected");

  const uncertainCases = cases.filter(
    item => isPending(item) && item.analysis?.isUncertain === true
  );

  const highPriorityCases = cases.filter(
    item =>
      isPending(item) &&
      String(item.analysis?.priority || "").toLowerCase() === "high"
  );

  const filteredCases = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const result = cases.filter(item => {
      const matchesSearch =
        !search ||
        String(item.id || "").toLowerCase().includes(search) ||
        String(item.complaint || "").toLowerCase().includes(search) ||
        String(item.analysis?.category || "").toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "All" || getStatus(item) === statusFilter;

      const matchesPriority =
        priorityFilter === "All" ||
        String(item.analysis?.priority || "Normal").toLowerCase() ===
          priorityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });

    return result.sort((a, b) => {
      const first = new Date(a.createdAt || 0).getTime();
      const second = new Date(b.createdAt || 0).getTime();
      return sortOrder === "newest" ? second - first : first - second;
    });
  }, [cases, searchTerm, statusFilter, priorityFilter, sortOrder]);

  const formatDate = (date) => {
    if (!date) return "Date unavailable";
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "Date unavailable";
    return parsedDate.toLocaleString();
  };

  const getStatusClass = (item) => {
    const status = getStatus(item);
    if (status === "Approved") return "approved-status";
    if (status === "Rejected") return "rejected-status";
    return "pending-status";
  };

  const getPriorityClass = (priority) => {
    const value = String(priority || "Normal").toLowerCase();
    if (value === "high") return "priority-high";
    if (value === "low") return "priority-low";
    return "priority-normal";
  };

  // --------------------------------------------------
  // CLEAR ALL CASES
  // --------------------------------------------------

  const openClearDialog = () => {
    setClearPassword("");
    setClearError("");
    setShowClearDialog(true);
  };

  const closeClearDialog = () => {
    if (clearingCases) return;
    setShowClearDialog(false);
    setClearPassword("");
    setClearError("");
  };

  const clearAllCases = async () => {
    if (!clearPassword.trim() || clearingCases || cases.length === 0) return;

    setClearingCases(true);
    setClearError("");

    try {
      const response = await fetch(`${API_URL}/api/cases`, {
        method: "DELETE",
        headers: {
          "x-clear-password": clearPassword
        }
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not clear saved cases.");
      }

      const deletedCount =
        typeof data.deletedCount === "number"
          ? data.deletedCount
          : cases.length;

      setCases([]);
      setSelectedCaseId("");
      setConfirmationCaseId("");
      setAnalysis(null);
      setAnalyzedComplaint("");
      setSearchTerm("");
      setStatusFilter("All");
      setPriorityFilter("All");
      setSortOrder("newest");

      setShowClearDialog(false);
      setClearPassword("");
      setClearError("");

      showToast(`${deletedCount} saved cases cleared successfully.`);
    } catch (err) {
      setClearError(err.message || "Could not clear saved cases.");
    } finally {
      setClearingCases(false);
    }
  };

  // --------------------------------------------------
  // CASE ANALYSIS
  // --------------------------------------------------

  const analyzeComplaint = async () => {
    if (!complaint.trim() || submitting) return;

    setSubmitting(true);
    setError("");
    setAnalysis(null);
    setAnalyzedComplaint("");
    setSelectedCaseId("");

    try {
      const cleanComplaint = complaint.trim();

      const analysisResponse = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint: cleanComplaint })
      });

      const analysisData = await readResponse(analysisResponse);

      if (!analysisResponse.ok) {
        throw new Error(
          analysisData.message || "Could not analyze the complaint."
        );
      }

      const result = analysisData.analysis;
      if (!result) throw new Error("The backend did not return an assessment.");

      const caseResponse = await fetch(`${API_URL}/api/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaint: cleanComplaint,
          analysis: result
        })
      });

      const caseData = await readResponse(caseResponse);

      if (!caseResponse.ok) {
        throw new Error(caseData.error || "Could not create the case.");
      }

      setAnalysis(result);
      setAnalyzedComplaint(cleanComplaint);
      setSelectedCaseId(caseData.case?.id || "");
      setComplaint("");

      await loadCases(false);
      showToast("Case created and saved successfully.");
    } catch (err) {
      setError(err.message || "Something went wrong while creating the case.");
    } finally {
      setSubmitting(false);
    }
  };

  const makeDecision = async (caseId, decision, confirmUncertain = false) => {
    if (decisionLoading) return;

    setDecisionLoading(caseId);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/cases/${caseId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            ...(confirmUncertain ? { confirmUncertain: true } : {})
          })
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not record the decision.");
      }

      setConfirmationCaseId("");
      await loadCases(false);

      showToast(
        decision === "approved"
          ? "Human approval recorded."
          : "Case rejection recorded."
      );
    } catch (err) {
      setError(err.message || "Could not save this decision.");
    } finally {
      setDecisionLoading("");
    }
  };

  // --------------------------------------------------
  // AGENT INVESTIGATION REPORT
  // --------------------------------------------------

  const renderInvestigation = (savedAnalysis, caseComplaint = "") => {
    const investigation = savedAnalysis?.investigation;

    if (!investigation) {
      return (
        <div className="agent-investigation">
          <div className="agent-heading">
            <div>
              <span className="eyebrow">AUTOMATED INVESTIGATION</span>
              <h3>Agent activity report</h3>
            </div>
            <span className="demo-label">NOT AVAILABLE</span>
          </div>
          <p className="muted-text">
            No investigation report is stored for this case.
          </p>
        </div>
      );
    }

    const toolCalls = Array.isArray(investigation.toolCalls)
      ? investigation.toolCalls
      : [];
    const evidence = Array.isArray(investigation.evidence)
      ? investigation.evidence
      : [];
    const conflicts = getInvestigationConflicts(caseComplaint, investigation);

    return (
      <div className="agent-investigation">
        <div className="agent-heading">
          <div>
            <span className="eyebrow">AUTOMATED INVESTIGATION</span>
            <h3>Agent activity report</h3>
          </div>
          <span className="demo-label">SIMULATED DATA</span>
        </div>

        <div className="agent-source-warning">
          <span>!</span>
          <div>
            <strong>Demonstration data only</strong>
            <p>
              The investigation tools currently use predefined simulated
              records. They are not connected to a real order, payment
              or delivery system.
            </p>
          </div>
        </div>

        <p className="agent-summary">
          {investigation.summary || "No investigation summary available."}
        </p>

        <div className="agent-status">
          <span>Investigation status</span>
          <strong>{investigation.investigationStatus || "Unknown"}</strong>
        </div>

        <div className="agent-metrics">
          <div>
            <small>TOOLS EXECUTED</small>
            <strong>{toolCalls.length}</strong>
          </div>
          <div>
            <small>EVIDENCE ITEMS</small>
            <strong>{evidence.length}</strong>
          </div>
          <div>
            <small>CONFLICTS FOUND</small>
            <strong>{conflicts.length}</strong>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="agent-conflicts">
            <div className="agent-conflict-heading">
              <span>!</span>
              <strong>Evidence discrepancy detected</strong>
            </div>
            {conflicts.map((conflict, index) => (
              <div className="agent-conflict" key={index}>
                <strong>{conflict.title}</strong>
                <p>{conflict.description}</p>
              </div>
            ))}
            <small>
              This discrepancy is a preliminary observation based on
              simulated records. Verify it against the actual business
              system before making a decision.
            </small>
          </div>
        )}

        <div className="agent-tools">
          <div className="agent-section-heading">
            <strong>Tools executed</strong>
            <span>{toolCalls.length} operations</span>
          </div>

          {toolCalls.length > 0 ? (
            toolCalls.map((tool, index) => (
              <div className="agent-tool" key={`${tool.tool}-${index}`}>
                <div className="agent-tool-heading">
                  <div>
                    <strong>
                      {tool.tool === "getOrderDetails"
                        ? "Order Details"
                        : tool.tool === "getPaymentDetails"
                        ? "Payment Details"
                        : tool.tool === "getDeliveryStatus"
                        ? "Delivery Status"
                        : "Investigation Tool"}
                    </strong>
                    <span className="agent-tool-source">
                      {tool.dataSource || "SIMULATED DATA"}
                    </span>
                  </div>
                  <span className="agent-tool-status">
                    {tool.status || "Unknown"}
                  </span>
                </div>

                <div className="agent-tool-description">
                  {tool.tool === "getOrderDetails" &&
                    "Checks the order record, product information, and order status."}
                  {tool.tool === "getPaymentDetails" &&
                    "Checks payment transactions, charges, and payment status."}
                  {tool.tool === "getDeliveryStatus" &&
                    "Checks delivery information and parcel tracking status."}
                </div>
              </div>
            ))
          ) : (
            <p className="muted-text">
              No tools were executed for this complaint.
            </p>
          )}
        </div>

        <div className="agent-evidence">
          <strong>Evidence retrieved</strong>
          {evidence.length > 0 ? (
            evidence.map((item, index) => (
              <p key={index}><span>✓</span> {item}</p>
            ))
          ) : (
            <p>No evidence was retrieved.</p>
          )}
        </div>

        <div className="agent-next-step">
          <strong>Required next step</strong>
          <p>
            {investigation.nextStep ||
              "A human reviewer must verify the investigation."}
          </p>
        </div>

        <div className="agent-human-review">
          <span>!</span>
          <div>
            <strong>Human review required</strong>
            <p>
              The investigation does not authorize refunds, replacements,
              payment changes or customer communications. A human must
              verify the findings and make the final decision.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // --------------------------------------------------
  // ASSESSMENT DISPLAY
  // --------------------------------------------------

  const renderAssessment = (
    savedAnalysis,
    caseComplaint = "",
    includeInvestigation = true
  ) => {
    if (!savedAnalysis) {
      return (
        <div className="assessment-empty">
          Assessment details are unavailable for this case.
        </div>
      );
    }

    const detected = Array.isArray(savedAnalysis.detectedCategories)
      ? savedAnalysis.detectedCategories
      : [];

    return (
      <div className="assessment">
        <div className="assessment-heading">
          <span className="eyebrow">CASE ASSESSMENT</span>
          <span className="demo-label">PRELIMINARY ASSESSMENT</span>
        </div>

        <div className="result-grid">
          <div className="result-item">
            <small>PRIORITY</small>
            <strong className={getPriorityClass(savedAnalysis.priority)}>
              {savedAnalysis.priority || "Normal"}
            </strong>
          </div>
          <div className="result-item">
            <small>SENTIMENT</small>
            <strong>{savedAnalysis.sentiment || "Neutral"}</strong>
          </div>
          <div className="result-item">
            <small>CATEGORY</small>
            <strong>{savedAnalysis.category || "General inquiry"}</strong>
          </div>
        </div>

        <div className="assessment-flags">
          <div>
            <span>Assessment status</span>
            <strong>
              {savedAnalysis.isUncertain ? "Needs human review" : "Rule match"}
            </strong>
          </div>
          <div>
            <span>Uncertain assessment</span>
            <strong>{savedAnalysis.isUncertain ? "Yes" : "No"}</strong>
          </div>
          <div>
            <span>Human review</span>
            <strong>Required</strong>
          </div>
        </div>

        <div className="detail-block">
          <strong>Detected categories</strong>
          <div className="category-tags">
            {detected.length > 0
              ? detected.map(category => <span key={category}>{category}</span>)
              : <span>No additional categories detected</span>}
          </div>
        </div>

        {savedAnalysis.isUncertain && (
          <div className="detail-block warning-block">
            <strong>Why human review is needed</strong>
            <p>
              {savedAnalysis.reviewReason ||
                "The assessment needs human confirmation before a decision."}
            </p>
          </div>
        )}

        <div className="detail-block">
          <strong>Recommended next step</strong>
          <p>{savedAnalysis.recommendation || "Review the complaint."}</p>
        </div>

        <div className="detail-block">
          <strong>Explanation</strong>
          <p>{savedAnalysis.reason || "No explanation available."}</p>
        </div>

        <div className="detail-block reply-block">
          <strong>Suggested customer reply</strong>
          <p>{savedAnalysis.customerReply || "No reply draft available."}</p>
          <small>Draft only. A human must review it before use.</small>
        </div>

        {includeInvestigation &&
          renderInvestigation(savedAnalysis, caseComplaint)}

        <div className="provider-note">
          Assessment provider: {savedAnalysis.provider || "Local demo rules"}
          {savedAnalysis.isRealAI === true
            ? " · AI provider"
            : " · Local demonstration rules"}
        </div>
      </div>
    );
  };

  // --------------------------------------------------
  // CASE ACTIVITY
  // --------------------------------------------------

  const renderActivity = (item) => {
    const activity = Array.isArray(item.activity) ? item.activity : [];

    if (!activity.length) {
      return <p className="muted-text">No activity recorded yet.</p>;
    }

    return (
      <div className="activity-list">
        {activity.slice().reverse().map(entry => (
          <div className="activity-entry" key={entry.id}>
            <span className="activity-dot"></span>
            <div>
              <strong>{entry.action}</strong>
              <small>{formatDate(entry.timestamp)}</small>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // --------------------------------------------------
  // CASE CARD
  // --------------------------------------------------

  const renderCaseCard = (item, index, approvalMode = false) => {
    const isExpanded = selectedCaseId === item.id;
    const isUncertain = item.analysis?.isUncertain === true;
    const confirming = confirmationCaseId === item.id;
    const busy = decisionLoading === item.id;

    return (
      <article className="case-card" key={item.id}>
        <div className="case-card-main">
          <div className="case-number">
            {String(index + 1).padStart(2, "0")}
          </div>

          <div className="case-card-content">
            <div className="case-title-row">
              <strong className="case-id">{item.id}</strong>
              <span className={`case-status ${getStatusClass(item)}`}>
                {getStatus(item)}
              </span>
            </div>

            <p className="case-complaint">{item.complaint}</p>

            <div className="case-meta">
              <span>{formatDate(item.createdAt)}</span>
              <span className="meta-divider">·</span>
              <span>{item.analysis?.category || "General inquiry"}</span>
              <span className={`priority-pill ${getPriorityClass(item.analysis?.priority)}`}>
                {item.analysis?.priority || "Normal"} priority
              </span>
            </div>

            <button
              className="text-button"
              onClick={() => setSelectedCaseId(isExpanded ? "" : item.id)}
            >
              {isExpanded ? "Hide case details ↑" : "View case details →"}
            </button>

            {isExpanded && (
              <div className="expanded-case">
                <div className="detail-block">
                  <strong>Customer complaint</strong>
                  <p>{item.complaint}</p>
                </div>
                {renderAssessment(item.analysis, item.complaint)}
                <div className="detail-block">
                  <strong>Activity history</strong>
                  {renderActivity(item)}
                </div>
              </div>
            )}

            {approvalMode && (
              <div className="approval-controls">
                {confirming && isUncertain ? (
                  <div className="confirmation-panel">
                    <div className="confirmation-icon">!</div>
                    <div className="confirmation-copy">
                      <strong>Confirm this uncertain assessment</strong>
                      <p>
                        This case has multiple potential complaint categories
                        or an uncertain result. Confirm that you have reviewed
                        the concerns before recording approval.
                      </p>
                      <small>
                        This records a human decision only. It does not issue
                        a refund, arrange a replacement or send a message.
                      </small>
                    </div>
                    <div className="approval-actions">
                      <button
                        className="approve-button"
                        disabled={busy}
                        onClick={() => makeDecision(item.id, "approved", true)}
                      >
                        {busy ? "Saving..." : "Confirm approval"}
                      </button>
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => setConfirmationCaseId("")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="approval-actions">
                    <button
                      className="approve-button"
                      disabled={Boolean(decisionLoading)}
                      onClick={() => {
                        if (isUncertain) {
                          setConfirmationCaseId(item.id);
                        } else {
                          makeDecision(item.id, "approved");
                        }
                      }}
                    >
                      {busy ? "Saving..." : "✓ Approve"}
                    </button>
                    <button
                      className="reject-button"
                      disabled={Boolean(decisionLoading)}
                      onClick={() => {
                        setConfirmationCaseId("");
                        makeDecision(item.id, "rejected");
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSelectedCaseId("");
    setConfirmationCaseId("");
    setError("");
  };

  // --------------------------------------------------
  // MAIN APPLICATION
  // --------------------------------------------------

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">R</div>
          <div className="brand-copy">
            <h2>Resolve<span>IQ</span></h2>
            <small>INTELLIGENT OPERATIONS</small>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation">
          {navItems.map(item => (
            <button
              key={item.label}
              className={`nav-item ${activeTab === item.label ? "active" : ""}`}
              onClick={() => switchTab(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.label === "Approvals" && pendingCases.length > 0 && (
                <span className="nav-count">{pendingCases.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot"></span>
            DEMO ENVIRONMENT
          </div>
          <div className="profile">
            <div className="avatar">R</div>
            <div>
              <strong>Workspace Admin</strong>
              <span>Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activeTab}
          </div>
          <div className="topbar-right">
            <span className="live-indicator">
              <span className="status-dot"></span>
              LOCAL DEMO
            </span>
            <button
              className="refresh-button"
              onClick={() => loadCases()}
              disabled={loading}
              title="Refresh cases"
            >
              ↻
            </button>
            <div className="top-avatar">R</div>
          </div>
        </header>

        <section className="page-content" key={activeTab}>
          <div className="welcome-row">
            <div>
              <div className="eyebrow">CUSTOMER OPERATIONS INTELLIGENCE</div>
              <h1>{activeTab === "Overview" ? "Command Center" : activeTab}</h1>
              <p>
                Understand customer issues. Make smarter decisions.
                Resolve faster.
              </p>
            </div>
            <div className="date-label">
              <span className="status-dot"></span>
              WORKSPACE ACTIVE
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span>!</span>
              <div>{error}</div>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}

          {toast && <div className="toast-message">✓ {toast}</div>}

          {/* OVERVIEW */}
          {activeTab === "Overview" && (
            <>
              <div className="hero-panel">
                <div className="hero-glow"></div>
                <div className="hero-copy">
                  <span className="hero-tag">✦ CUSTOMER OPERATIONS PLATFORM</span>
                  <h2>
                    Turn customer problems
                    <br />
                    into <em>smarter decisions.</em>
                  </h2>
                  <p>
                    Capture complaints, investigate potential issues,
                    review evidence and keep important decisions under
                    human control.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => switchTab("Case Analyzer")}
                  >
                    Analyze a complaint <span>→</span>
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="hero-ring ring-one"></div>
                  <div className="hero-ring ring-two"></div>
                  <div className="hero-core">R<span>✦</span></div>
                  <div className="hero-chip chip-one">CASE INTELLIGENCE</div>
                  <div className="hero-chip chip-two">HUMAN REVIEW</div>
                </div>
              </div>

              <div className="section-heading">
                <div>
                  <span className="eyebrow">WORKSPACE SNAPSHOT</span>
                  <h3>Operations overview</h3>
                </div>
                <span className="demo-label">SAVED CASE DATA</span>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top"><span>Total cases</span><b>◈</b></div>
                  <strong>{cases.length}</strong>
                  <small>All saved customer cases</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><span>Pending review</span><b>◷</b></div>
                  <strong>{pendingCases.length}</strong>
                  <small>Awaiting a human decision</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><span>Approved</span><b>✓</b></div>
                  <strong>{approvedCases.length}</strong>
                  <small>Human approvals recorded</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><span>Rejected</span><b>×</b></div>
                  <strong>{rejectedCases.length}</strong>
                  <small>Human rejections recorded</small>
                </div>
              </div>

              <div className="insight-grid">
                <div className="insight-card">
                  <span className="insight-icon red-icon">!</span>
                  <div>
                    <small>HIGH PRIORITY PENDING</small>
                    <strong>{highPriorityCases.length}</strong>
                    <p>Cases marked high priority</p>
                  </div>
                </div>
                <div className="insight-card">
                  <span className="insight-icon amber-icon">◇</span>
                  <div>
                    <small>UNCERTAIN ASSESSMENTS</small>
                    <strong>{uncertainCases.length}</strong>
                    <p>Need additional human attention</p>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">CUSTOMER RECORDS</span>
                    <h3>Recent cases</h3>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => switchTab("Case History")}
                  >
                    View all cases →
                  </button>
                </div>

                {loading ? (
                  <div className="empty-state">Loading saved cases...</div>
                ) : cases.length === 0 ? (
                  <div className="empty-state">
                    <strong>No cases yet</strong>
                    <p>Start by analyzing your first customer complaint.</p>
                    <button
                      className="primary-button"
                      onClick={() => switchTab("Case Analyzer")}
                    >
                      Open Case Analyzer →
                    </button>
                  </div>
                ) : (
                  <div className="case-list">
                    {cases.slice().reverse().slice(0, 4).map(
                      (item, index) => renderCaseCard(item, index)
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* CASE ANALYZER */}
          {activeTab === "Case Analyzer" && (
            <>
              <div className="analyzer-layout">
                <div className="panel analyzer-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">COMPLAINT INTAKE</span>
                      <h3>Customer case analyzer</h3>
                    </div>
                    <span className="ai-badge">LOCAL AGENT WORKFLOW</span>
                  </div>

                  <p className="panel-description">
                    Enter a complaint to generate a preliminary assessment,
                    execute relevant investigation tools and save the
                    findings for human review.
                  </p>

                  <label htmlFor="complaint">CUSTOMER COMPLAINT</label>
                  <textarea
                    id="complaint"
                    value={complaint}
                    onChange={event => setComplaint(event.target.value)}
                    placeholder="Example: My order arrived damaged and I was charged twice. I need help resolving both issues..."
                    maxLength={5000}
                  />

                  <div className="input-footer">
                    <span>{complaint.length}/5000 characters</span>
                    <button
                      className="primary-button analyze-button"
                      onClick={analyzeComplaint}
                      disabled={submitting || !complaint.trim()}
                    >
                      {submitting ? (
                        <>
                          <span className="button-spinner"></span>
                          Analyzing...
                        </>
                      ) : (
                        <>Investigate & create case <span>→</span></>
                      )}
                    </button>
                  </div>

                  {analysis && (
                    <div className="analysis-result">
                      <div className="result-title">
                        <div>
                          <span className="eyebrow">ASSESSMENT GENERATED</span>
                          <h3>Case assessment</h3>
                        </div>
                        <span className="demo-label">DEMO ENGINE</span>
                      </div>
                      <div className="success-note">
                        ✓ Case {selectedCaseId} has been saved and
                        added to the review queue.
                      </div>
                      {renderAssessment(analysis, analyzedComplaint, false)}
                      <button
                        className="secondary-button"
                        onClick={() => switchTab("Approvals")}
                      >
                        Open approval queue →
                      </button>
                    </div>
                  )}
                </div>

                <div className="panel activity-panel">
                  <span className="eyebrow">AGENT WORKFLOW</span>
                  <h3>From complaint to evidence</h3>
                  <div className="workflow">
                    {[
                      ["01", "Capture", "Receive and save customer complaints."],
                      ["02", "Assess", "Classify the complaint using local rules."],
                      ["03", "Investigate", "Select and execute relevant demonstration tools."],
                      ["04", "Verify", "Inspect returned records and potential discrepancies."],
                      ["05", "Human review", "Record an approval or rejection."]
                    ].map((step, index) => (
                      <div className="workflow-item" key={step[0]}>
                        <div className="step-icon">{step[0]}</div>
                        <div>
                          <strong>{step[1]}</strong>
                          <p>{step[2]}</p>
                        </div>
                        {index !== 4 && <div className="workflow-connector"></div>}
                      </div>
                    ))}
                  </div>
                  <div className="safety-note">
                    <span>!</span>
                    <div>
                      <strong>Human-in-the-loop protection</strong>
                      <p>
                        Investigation results are demonstration data.
                        The system does not execute refunds, replacements
                        or customer communications.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {analysis && (
                <div className="investigation-wide-panel">
                  {renderInvestigation(analysis, analyzedComplaint)}
                </div>
              )}

              <footer>
                RESOLVEIQ <span>·</span> INTELLIGENCE WITH ACCOUNTABILITY
                <span>·</span> LOCAL DEMO
              </footer>
            </>
          )}

          {/* CASE HISTORY */}
          {activeTab === "Case History" && (
            <div className="panel">
              <div className="panel-heading history-heading">
                <div>
                  <span className="eyebrow">CUSTOMER RECORDS</span>
                  <h3>Complete case history</h3>
                  <p className="panel-description">
                    Search, filter and inspect saved customer cases.
                  </p>
                </div>

                <div className="history-actions">
                  <span className="demo-label">{cases.length} TOTAL CASES</span>
                  <button
                    className="danger-button"
                    onClick={openClearDialog}
                    disabled={cases.length === 0 || clearingCases}
                  >
                    Clear all cases
                  </button>
                </div>
              </div>

              <div className="filter-bar">
                <div className="search-field">
                  <span>⌕</span>
                  <input
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    placeholder="Search case ID, complaint or category..."
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="All">All statuses</option>
                  <option value="Pending review">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={event => setPriorityFilter(event.target.value)}
                  aria-label="Filter by priority"
                >
                  <option value="All">All priorities</option>
                  <option value="High">High priority</option>
                  <option value="Normal">Normal priority</option>
                  <option value="Low">Low priority</option>
                </select>

                <select
                  value={sortOrder}
                  onChange={event => setSortOrder(event.target.value)}
                  aria-label="Sort cases"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>

              {loading ? (
                <div className="empty-state">Loading case history...</div>
              ) : filteredCases.length === 0 ? (
                <div className="empty-state">
                  <strong>No matching cases</strong>
                  <p>Try changing your search or filters.</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("All");
                      setPriorityFilter("All");
                      setSortOrder("newest");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="case-list">
                  {filteredCases.map((item, index) =>
                    renderCaseCard(item, index)
                  )}
                </div>
              )}
            </div>
          )}

          {/* APPROVALS */}
          {activeTab === "Approvals" && (
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">HUMAN REVIEW CENTER</span>
                  <h3>Pending approvals</h3>
                  <p className="panel-description">
                    Review assessments and investigation evidence
                    before recording a human decision.
                  </p>
                </div>
                <span className="demo-label">
                  {pendingCases.length} AWAITING REVIEW
                </span>
              </div>

              <div className="approval-summary">
                <div>
                  <small>Pending cases</small>
                  <strong>{pendingCases.length}</strong>
                </div>
                <div>
                  <small>Uncertain cases</small>
                  <strong className="text-red">{uncertainCases.length}</strong>
                </div>
                <div>
                  <small>High priority</small>
                  <strong>{highPriorityCases.length}</strong>
                </div>
              </div>

              {loading ? (
                <div className="empty-state">Loading approval queue...</div>
              ) : pendingCases.length === 0 ? (
                <div className="empty-state">
                  <strong>Approval queue is clear</strong>
                  <p>New cases will appear here after analysis.</p>
                </div>
              ) : (
                <div className="case-list">
                  {pendingCases.map((item, index) =>
                    renderCaseCard(item, index, true)
                  )}
                </div>
              )}
            </div>
          )}

          <div className="page-footer">
            <span>RESOLVEIQ</span>
            <span>LOCAL DEMONSTRATION ENVIRONMENT</span>
            <span>HUMAN DECISIONS REMAIN IN CONTROL</span>
          </div>
        </section>
      </main>

      {/* CLEAR ALL CASES CONFIRMATION */}
      {showClearDialog && (
        <div
          className="clear-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeClearDialog();
          }}
        >
          <div
            className="clear-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-modal-title"
          >
            <div className="clear-modal-header">
              <div className="clear-modal-icon">!</div>
              <button
                className="clear-modal-close"
                onClick={closeClearDialog}
                disabled={clearingCases}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <span className="eyebrow">DESTRUCTIVE ACTION</span>
            <h2 id="clear-modal-title">Clear all saved cases?</h2>

            <p className="clear-modal-warning">
              This will permanently delete all <strong>{cases.length}</strong>{" "}
              saved cases, including their assessments and decision history.
              This action cannot be undone.
            </p>

            <label htmlFor="clear-password">
              ADMINISTRATOR PASSWORD
            </label>
            <input
              id="clear-password"
              className="clear-password-input"
              type="password"
              value={clearPassword}
              onChange={event => {
                setClearPassword(event.target.value);
                setClearError("");
              }}
              placeholder="Enter your clear-cases password"
              autoComplete="current-password"
              disabled={clearingCases}
              onKeyDown={event => {
                if (event.key === "Enter") clearAllCases();
              }}
            />

            {clearError && (
              <div className="clear-error-message" role="alert">
                {clearError}
              </div>
            )}

            <div className="clear-modal-actions">
              <button
                className="clear-cancel-button"
                onClick={closeClearDialog}
                disabled={clearingCases}
              >
                Cancel
              </button>
              <button
                className="clear-confirm-button"
                onClick={clearAllCases}
                disabled={!clearPassword.trim() || clearingCases}
              >
                {clearingCases ? "Deleting cases..." : "Delete all cases"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
