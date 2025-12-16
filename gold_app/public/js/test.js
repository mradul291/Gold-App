//Metrics Tab
window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.metrics = function ($mount, state) {
  const html = `
        <div class="wmt-root">

            <!-- Page Title -->
            <div class="wmt-title">Transaction Metrics</div>

            <!-- WEIGHT & PURITY ANALYSIS -->
            <div class="wmt-card">
                <div class="wmt-card-header">WEIGHT & PURITY ANALYSIS</div>

                <div class="wmt-two-col">
                    <div class="wmt-col">

                        <div class="wmt-row">
                            <div class="wmt-label">Original Gross Weight</div>
                            <div class="wmt-value">300.00 g</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">Weight Loss</div>
                            <div class="wmt-value wmt-negative">5.00 g</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">XAU Weight Loss</div>
                            <div class="wmt-value wmt-negative">19.44 g</div>
                        </div>

                        <div class="wmt-divider"></div>

                        <div class="wmt-row">
                            <div class="wmt-label">Original Avg Purity</div>
                            <div class="wmt-value">388.83%</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">Purity Variance</div>
                            <div class="wmt-value wmt-negative">-296.33%</div>
                        </div>
                    </div>

                    <div class="wmt-col">

                        <div class="wmt-row">
                            <div class="wmt-label">Weight After Melting</div>
                            <div class="wmt-value">295.00 g</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">Weight Loss %</div>
                            <div class="wmt-value wmt-negative">1.67%</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">Net Weight For Sale</div>
                            <div class="wmt-value">293.00 g</div>
                        </div>

                        <div class="wmt-divider"></div>

                        <div class="wmt-row">
                            <div class="wmt-label">Assay Purity</div>
                            <div class="wmt-value">92.50%</div>
                        </div>

                        <div class="wmt-row">
                            <div class="wmt-label">XAU Weight Variance</div>
                            <div class="wmt-value wmt-negative">-874.18 g</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- COST + PROFIT -->
            <div class="wmt-bottom-grid">
                <div class="wmt-card">
                    <div class="wmt-card-header">COST ANALYSIS</div>

                    <div class="wmt-row">
                        <div class="wmt-label">Original Gold Cost</div>
                        <div class="wmt-value">RM 23,500.00</div>
                    </div>

                    <div class="wmt-row">
                        <div class="wmt-label">Melting Cost</div>
                        <div class="wmt-value">RM 150.00</div>
                    </div>

                    <div class="wmt-row">
                        <div class="wmt-label">Assay Cost</div>
                        <div class="wmt-value">RM 100.00</div>
                    </div>

                    <div class="wmt-divider"></div>

                    <div class="wmt-row wmt-total-row">
                        <div class="wmt-label">Total Cost</div>
                        <div class="wmt-value">RM 23,750.00</div>
                    </div>
                </div>

                <div class="wmt-card wmt-profit-card">
                    <div class="wmt-card-header">REVENUE & PROFIT</div>

                    <div class="wmt-row">
                        <div class="wmt-label">Total Revenue</div>
                        <div class="wmt-value">RM 510,688.14</div>
                    </div>

                    <div class="wmt-row">
                        <div class="wmt-label">Total Cost</div>
                        <div class="wmt-value">RM 23,750.00</div>
                    </div>

                    <div class="wmt-divider"></div>

                    <div class="wmt-row wmt-profit-row">
                        <div class="wmt-label">Gross Profit</div>
                        <div class="wmt-profit-value">RM 486,938.14</div>
                    </div>

                    <div class="wmt-row">
                        <div class="wmt-label">Profit Margin</div>
                        <div class="wmt-profit-percent">95.35%</div>
                    </div>
                </div>
            </div>

             <!-- PROCESS EFFICIENCY -->
            <div class="wmt-card">
                <div class="wmt-card-header">PROCESS EFFICIENCY</div>

                <div class="wmt-efficiency-grid">
                    <div class="wmt-eff-card">
                        <div class="wmt-eff-label">Melting Efficiency</div>
                        <div class="wmt-eff-value">98.3%</div>
                    </div>

                    <div class="wmt-eff-card wmt-eff-green">
                        <div class="wmt-eff-label">XAU Recovery</div>
                        <div class="wmt-eff-value">23.8%</div>
                    </div>

                    <div class="wmt-eff-card wmt-eff-blue">
                        <div class="wmt-eff-label">Net Sellable</div>
                        <div class="wmt-eff-value">97.7%</div>
                    </div>

                    <div class="wmt-eff-card wmt-eff-purple">
                        <div class="wmt-eff-label">Profit per XAU</div>
                        <div class="wmt-eff-value">1797</div>
                    </div>
                </div>
            </div>

            <!-- VS LAST SALE -->
            <div class="wmt-card">
                <div class="wmt-card-header">VS LAST SALE</div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">Weight Loss %</div>
                    <div class="wmt-compare-old">2.10%</div>
                    <div class="wmt-compare-new">1.67%</div>
                    <div class="wmt-compare-diff wmt-positive">+0.43%</div>
                </div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">XAU Recovery Rate</div>
                    <div class="wmt-compare-old">102.50%</div>
                    <div class="wmt-compare-new">23.79%</div>
                    <div class="wmt-compare-diff wmt-negative">-78.71%</div>
                </div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">Purity Variance</div>
                    <div class="wmt-compare-old">2.80%</div>
                    <div class="wmt-compare-new">-296.33%</div>
                    <div class="wmt-compare-diff wmt-negative">-299.13%</div>
                </div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">Net Sellable %</div>
                    <div class="wmt-compare-old">96.90%</div>
                    <div class="wmt-compare-new">97.67%</div>
                    <div class="wmt-compare-diff wmt-positive">+0.77%</div>
                </div>

                <div class="wmt-compare-row">
                    <div class="wmt-compare-label">Profit Margin</div>
                    <div class="wmt-compare-old">94.80%</div>
                    <div class="wmt-compare-new">95.35%</div>
                    <div class="wmt-compare-diff wmt-positive">+0.55%</div>
                </div>
            </div>

        </div>
    `;

  $mount.html(html);

  // ---------------------------------------------------------
  // COMPUTE METRICS AND STORE IN STATE
  // ---------------------------------------------------------
  (function computeMetrics() {
    const s = state.bag_summary || {};
    const melt = state.melting || {};
    const assay = state.assay || {};
    const sale = state.sale || {};

    // BAG SUMMARY VALUES
    const grossWeight = s.total_weight_g || 0;
    const avgPurity = s.average_purity || 0;
    const originalGoldCost = s.total_cost_basis || 0;

    // MELTING VALUES
    const afterMelting = melt.after || 0;
    const weightLoss = melt.weight_loss || 0;
    const xauLoss = melt.xau_loss || 0;
    const weightLossPct = melt.loss_percentage || 0;

    // ASSAY VALUES
    const assayPurity = assay.assay_purity || 0;
    const purityVariance = assay.purity_variance || 0;
    const xauVariance = assay.xau_weight_variance || 0;

    const netWeightSale = assay.sample_weight
      ? afterMelting - assay.sample_weight
      : afterMelting;
    const netSellableXau = assay.net_sellable || 0;

    // COST METRICS
    const meltingCost = melt.cost || 0;
    const assayCost = assay.cost || 0;
    const totalCost = originalGoldCost + meltingCost + assayCost;

    // REVENUE & PROFIT
    const revenue = sale.total_revenue || 0;
    const grossProfit = revenue - totalCost;
    const profitMargin = revenue ? (grossProfit / revenue) * 100 : 0;

    // EFFICIENCY
    const meltingEfficiency = grossWeight
      ? (afterMelting / grossWeight) * 100
      : 0;
    const xauRecovery = s.pure_gold_xau_g
      ? (netSellableXau / s.pure_gold_xau_g) * 100
      : 0;
    const netSellablePct = grossWeight
      ? (netWeightSale / grossWeight) * 100
      : 0;
    const profitPerXau = netSellableXau ? grossProfit / netSellableXau : 0;

    // FINAL METRICS OBJECT STORED IN STATE
    state.metrics = {
      // Weight & Purity
      m_original_gross_weight: grossWeight,
      m_weight_after_melting: afterMelting,
      m_weight_loss: weightLoss,
      m_weight_loss_percentage: weightLossPct,
      m_xau_weight_loss: xauLoss,
      m_net_weight_sale: netWeightSale,

      m_original_avg_purity: avgPurity,
      m_assay_purity: assayPurity,
      m_purity_variance: purityVariance,
      m_xau_weight_variance: xauVariance,

      // Cost
      m_original_gold_cost: originalGoldCost,
      m_melting_cost: meltingCost,
      m_assay_cost: assayCost,
      m_total_cost: totalCost,

      // Revenue
      m_total_revenue: revenue,
      m_total_cost_profit: totalCost,
      m_gross_profit: grossProfit,
      m_profit_margin: profitMargin,

      // Efficiency
      m_melting_efficiency: meltingEfficiency,
      m_xau_recovery: xauRecovery,
      m_net_sellable: netSellablePct,
      m_profit_per_xau: profitPerXau,

      // VS Last Sale (Static UI values)
      vs_weight_loss_percentage: 2.1,
      vs_xau_recovery_rate: 102.5,
      vs_purity_variance: 2.8,
      vs_net_sellable_percentage: 96.9,
      vs_profit_margin: 94.8,
    };
  })();
};

// gold_app/page/wholesale_bag_melt/wholesale_bag_melt.js

let WBMState = {
  selected_bag: null,
  bag_summary: null,
  bag_items: [],
  bag_list: [],
};

frappe.pages["wholesale-bag-melt"].on_page_load = function (wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: "Select Wholesale Bag to Melt",
    single_column: true,
  });

  $(page.body).append(`
        <div id="wbdm-root" class="wbdm-page">
            <div class="wbdm-inner">
				<div id="wbdm-loader" class="loader-overlay">
    				<div class="loader"></div>
    				<p>Loading...</p>
				</div>
                <div id="wbdm-bag-list" class="wbdm-grid"></div>
            </div>
        </div>
    `);

  frappe.require("/assets/gold_app/css/wholesale_bag_melt.css");

  // detect resume param
  const urlParams = new URLSearchParams(window.location.search);
  const RESUME_LOG_ID = urlParams.get("log_id");

  if (RESUME_LOG_ID) {
    // show small loader while we load the saved doc
    $("#wbdm-loader").fadeIn(150);
    $("#wbdm-bag-list").hide();

    // call the resume loader
    loadResumeData(RESUME_LOG_ID);
    return; // skip normal bag-overview flow (we will load bag overview in background if needed)
  }

  $("#wbdm-loader").fadeIn(150);
  $("#wbdm-bag-list").hide();

  frappe.call({
    method: "gold_app.api.sales.wholesale_bag_melt.get_bag_overview",
    callback: function (r) {
      if (r.message) {
        $("#wbdm-loader").fadeOut(200, () => {
          $("#wbdm-bag-list").fadeIn(200);
        });

        WBMState.bag_list = r.message;
        renderBagGrid(WBMState.bag_list);

        WBMState.onBackToBags = function () {
          $("#wbdm-root").html(`
                        <div class="wbdm-inner">
                            <div id="wbdm-bag-list" class="wbdm-grid"></div>
                        </div>
                    `);
          renderBagGrid(WBMState.bag_list);
        };
      }
    },
  });
};

// ==============================================
// RENDER BAG CARD GRID
// ==============================================
function renderBagGrid(bags) {
  const grid = $("#wbdm-bag-list");
  grid.empty();

  const fmtNumber = (val, decimals) => {
    if (val === null || val === undefined || val === "") return "";
    const n = typeof val === "number" ? val : parseFloat(String(val));
    return n.toLocaleString("en-MY", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  bags.forEach((bag) => {
    grid.append(`
            <div class="wbdm-card">
                <div class="wbdm-bag-title">${bag.bag_id}</div>

                <div class="wbdm-row">
                    <span>Total Weight</span>
                    <strong>${fmtNumber(bag.total_weight, 0)}g</strong>
                </div>

                <div class="wbdm-row">
                    <span>XAU (Pure Gold)</span>
                    <strong class="wbdm-blue">${fmtNumber(
                      bag.xau_g,
                      2
                    )}g</strong>
                </div>

                <div class="wbdm-row">
                    <span>Avg Purity</span>
                    <strong>${fmtNumber(bag.avg_purity, 1)}</strong>
                </div>

                <div class="wbdm-row">
                    <span>Total Cost</span>
                    <strong>RM${fmtNumber(bag.total_cost, 2)}</strong>
                </div>

                <div class="wbdm-row">
                    <span>Cost per Gram</span>
                    <strong>RM${fmtNumber(bag.cost_per_gram, 2)}</strong>
                </div>

                <div class="wbdm-view-items">▼ View Items</div>

                <button class="wbdm-select-btn" data-bag="${bag.bag_id}">
                    SELECT BAG
                </button>
            </div>
        `);
  });

  $(".wbdm-select-btn")
    .off("click")
    .on("click", function () {
      const bagId = $(this).data("bag");

      WBMState.selected_bag = bagId;

      frappe.call({
        method: "gold_app.api.sales.wholesale_bag_melt.get_bag_details",
        args: { bag_id: bagId },
        callback: function (r) {
          if (!r.message) return;

          WBMState.bag_summary = r.message.summary;
          WBMState.bag_items = r.message.items;

          WBMState.bag_summary.record_id = WBMState.selected_bag;
          WBMState.bag_summary.record_date = getTodayDate();

          showBagSummaryUI();
        },
      });
    });

  $(".wbdm-view-items")
    .off("click")
    .on("click", function () {
      const card = $(this).closest(".wbdm-card");
      const bagId = card.find(".wbdm-select-btn").data("bag");

      WBMState.selected_bag = bagId;

      frappe.call({
        method: "gold_app.api.sales.wholesale_bag_melt.get_bag_details",
        args: { bag_id: bagId },
        callback: function (r) {
          if (!r.message) return;

          WBMState.bag_summary = r.message.summary;
          WBMState.bag_items = r.message.items;

          showBagSummaryUI();
        },
      });
    });
}

// ==============================================
// SHOW GLOBAL SHELL + TABS (SAVE BUTTON ADDED)
// ==============================================
function showBagSummaryUI() {
  $("#wbdm-root").html(`
        <div class="wbm-page-shell">

            <!-- HEADER -->
            <div class="wbm-header">
                <div class="wbm-header-inner">

                    <div class="wbm-header-left">
                        <div class="wbm-record-title">Melt & Assay Sales</div>
                        <div class="wbm-record-meta">
                            <a class="wbm-record-id">
                                ${WBMState.bag_summary.record_id || "-"}
                            </a>
                            <span class="wbm-dot-sep">•</span>
                            <span class="wbm-record-date-label">Sale Date:</span>
                            <span class="wbm-record-date-value">
                                ${WBMState.bag_summary.record_date || "-"}
                            </span>
                        </div>
                    </div>

                    <!-- ✅ SAVE BUTTON (RIGHT SIDE) -->
                    <div class="wbm-header-right">
                        <button id="wbm-save-btn" class="wbm-save-btn">Save</button>
                    </div>

                </div>

                <!-- TABS -->
                <div class="wbm-tabs-bar">
                    <div class="wbm-tab-item" data-tab="bag_summary">Bag Summary</div>
                    <div class="wbm-tab-item" data-tab="melting_assay">Melting & Assay</div>
                    <div class="wbm-tab-item" data-tab="buyer_sale">Sales Detail</div>
                    <div class="wbm-tab-item" data-tab="metrics">Metrics</div>
                </div>
            </div>

            <!-- TAB CONTENT -->
            <div class="wbm-page-body">
				<div id="wbm-tab-loader" class="loader-overlay">
    				<div class="loader"></div>
    				<p>Loading...</p>
				</div>
                <div id="wbd-content" class="wbm-main-card"></div>
            </div>

        </div>
    `);

  WBMState.onSaveRecord = saveMeltAssaySales;

  // default tab
  loadTabContent("bag_summary");
  $(`.wbm-tab-item[data-tab="bag_summary"]`).addClass("wbm-tab-active");

  $(".wbm-tab-item").on("click", function () {
    $(".wbm-tab-item").removeClass("wbm-tab-active");
    $(this).addClass("wbm-tab-active");

    const tab = $(this).data("tab");
    loadTabContent(tab);
  });

  $(document).on("click", "#wbm-save-btn", function () {
    if (WBMState.onSaveRecord) {
      WBMState.onSaveRecord();
    }
  });
}

// ==============================================
// TAB CONTENT LOADER
// ==============================================
function loadTabContent(tabName) {
  const map = {
    bag_summary: "/assets/gold_app/js/bag_summary.js",
    melting_assay: "/assets/gold_app/js/melting_assay.js",
    buyer_sale: "/assets/gold_app/js/buyer_sale.js",
    metrics: "/assets/gold_app/js/metrics.js",
  };

  const path = map[tabName];
  if (!path) return;

  // SHOW LOADER
  $("#wbm-tab-loader").fadeIn(150);
  $("#wbd-content").hide();

  frappe.require(path, () => {
    if (window.WBMComponents && window.WBMComponents[tabName]) {
      window.WBMComponents[tabName]($("#wbd-content"), WBMState);

      // HIDE LOADER AFTER RENDER
      $("#wbm-tab-loader").fadeOut(200, () => {
        $("#wbd-content").fadeIn(200);
      });
    }
  });
}

/**
 * loadResumeData(log_id)
 * - Fetches resume payload from backend
 * - Maps server fields -> frontend WBMState shape
 * - Calls showBagSummaryUI() and selects default tab
 */
function loadResumeData(log_id) {
  if (!log_id) return;

  frappe.call({
    method: "gold_app.api.sales.wholesale_bag_melt.get_resume_data",
    args: { log_id: log_id },
    callback: function (r) {
      if (!r.message) {
        frappe.msgprint("Failed to load saved record: " + (log_id || ""));
        // fallback to normal bag overview
        loadBagOverviewFallback();
        return;
      }

      const payload = r.message || {};
      const header = payload.header || {};
      const bag_contents = payload.bag_contents || [];
      const locked_rates = payload.locked_rates || [];

      // 1) Bag summary mapping — match keys expected by bag_summary component
      WBMState.bag_summary = {
        // use record_id if saved in header else fallback to doc name
        record_id: header.record_id || payload.name || header.name || log_id,
        record_date: header.posting_date || header.date || getTodayDate(),

        // map names used by bag_summary component
        total_weight_g:
          header.total_weight || header.m_original_gross_weight || 0,
        average_purity: header.avg_purity || header.m_original_avg_purity || 0,
        pure_gold_xau_g: header.total_xau || 0,
        total_cost_basis: header.total_cost || 0,
        // keep other useful fields too
        xau_avco: header.xau_avco || 0,
      };

      // 2) bag_items mapping — adapt saved child table shape to component expected shape
      WBMState.bag_items = (bag_contents || []).map((row) => ({
        purity: row.purity || "",
        weight_g: row.weight || 0,
        cost_per_g_rm: row.avco || 0,
        cost_rm: row.cost || 0,
        xau_g: row.xau || 0,
        xau_avco: row.xau_avco || 0,
      }));

      // 3) melting
      WBMState.melting = {
        before: header.weight_before_melting || 0,
        after: header.weight_after_melting || 0,
        cost: header.melting_cost || 0,
        payment_mode: header.melting_payment_mode || "",
        weight_loss: header.weight_loss || 0,
        xau_loss: header.xau_loss || 0,
        loss_percentage: header.loss_percentage || 0,
      };

      // 4) assay
      WBMState.assay = {
        current_purity:
          header.current_avg_purity || WBMState.bag_summary.average_purity || 0,
        assay_purity: header.assay_purity || 0,
        purity_variance: header.purity_variance || 0,
        xau_weight_variance: header.xau_weight_variance || 0,
        actual_xau_weight: header.actual_xau_weight || 0,
        assay_sample_weight: header.assay_sample_weight || 0,
        net_sellable: header.net_xau_sellable || 0,
        cost: header.assay_cost || 0,
        payment_mode: header.assay_payment_mode || "",
      };

      // 5) sale
      WBMState.sale = {
        net_weight: header.sale_net_weight || 0,
        assay_purity: header.sale_assay_purity || 0,
        net_xau: header.sale_net_xau || 0,
        total_xau_sold: header.total_xau_sold || 0,
        total_revenue: header.total_revenue || 0,
        weighted_avg_rate: header.weighted_avg_rate || 0,
        locked_rates: locked_rates || [],
      };

      // 6) metrics
      WBMState.metrics = header || {}; // since header already contains m_* fields

      // 7) store bag_list in background (optional) — helpful for UI that uses bag overview
      frappe.call({
        method: "gold_app.api.sales.wholesale_bag_melt.get_bag_overview",
        callback: function (ov) {
          if (ov && ov.message) {
            WBMState.bag_list = ov.message;
          }
        },
      });

      // 8) now render UI shell and restore tabs
      showBagSummaryUI();

      // after render, make sure the default tab loads and that tab components pick up restored WBMState
      // If you want to open a specific tab (e.g., 'buyer_sale'), set it here:
      // loadTabContent("buyer_sale"); and set active class
      // For now we keep default bag_summary (as showBagSummaryUI already loads it)
    },
    error: function (err) {
      console.error("Resume load failed", err);
      frappe.msgprint("Failed to load resume data.");
      // fallback to bag-overview
      loadBagOverviewFallback();
    },
  });
}

// helper to fallback to normal overview if resume fails
function loadBagOverviewFallback() {
  // normal flow - fetch bag overview
  frappe.call({
    method: "gold_app.api.sales.wholesale_bag_melt.get_bag_overview",
    callback: function (r) {
      if (r.message) {
        $("#wbdm-loader").fadeOut(200, () => {
          $("#wbdm-bag-list").fadeIn(200);
        });
        WBMState.bag_list = r.message;
        renderBagGrid(WBMState.bag_list);

        WBMState.onBackToBags = function () {
          $("#wbdm-root").html(`
                        <div class="wbdm-inner">
                            <div id="wbdm-bag-list" class="wbdm-grid"></div>
                        </div>
                    `);
          renderBagGrid(WBMState.bag_list);
        };
      }
    },
  });
}

function getTodayDate() {
  const d = new Date();
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}

function saveMeltAssaySales() {
  // 1️⃣ --- BAG SUMMARY DATA ---
  const summary = WBMState.bag_summary || {};
  const bagContents = WBMState.bag_items || [];

  // 2️⃣ --- MELTING & ASSAY DATA ---
  const melt = WBMState.melting || {};
  const assay = WBMState.assay || {};

  // 3️⃣ --- BUYER SALE DATA ---
  const sale = WBMState.sale || {};

  // 4️⃣ --- METRICS DATA ---
  const metrics = WBMState.metrics || {};

  // 5️⃣ --- BUILD CLEAN PAYLOAD ---
  const payload = {
    header: {
      // BAG SUMMARY
      total_weight: summary.total_weight_g,
      avg_purity: summary.average_purity,
      total_xau: summary.pure_gold_xau_g,
      total_cost: summary.total_cost_basis,
      xau_avco:
        summary.total_cost_basis && summary.pure_gold_xau_g
          ? summary.total_cost_basis / summary.pure_gold_xau_g
          : 0,

      // MELTING
      weight_before_melting: melt.before,
      weight_after_melting: melt.after,
      melting_cost: melt.cost,
      melting_payment_mode: melt.payment_mode,
      weight_loss: melt.weight_loss,
      xau_loss: melt.xau_loss,
      loss_percentage: melt.loss_percentage,

      // ASSAY
      current_avg_purity: assay.current_purity,
      assay_purity: assay.assay_purity,
      purity_variance: assay.purity_variance,
      xau_weight_variance: assay.xau_weight_variance,
      actual_xau_weight: assay.actual_xau_weight,
      assay_sample_weight: assay.assay_sample_weight,
      net_xau_sellable: assay.net_sellable,
      assay_cost: assay.cost,
      assay_payment_mode: assay.payment_mode,

      // SALES DATA
      sale_net_weight: sale.net_weight,
      sale_assay_purity: sale.assay_purity,
      sale_net_xau: sale.net_xau,
      total_xau_sold: sale.total_xau_sold,
      total_revenue: sale.total_revenue,
      weighted_avg_rate: sale.weighted_avg_rate,

      // METRICS (optional)
      ...metrics,
    },

    bag_contents: bagContents.map((r) => ({
      purity: r.purity,
      weight: r.weight_g,
      avco: r.cost_per_g_rm,
      cost: r.cost_rm,
      xau: r.xau_g,
      xau_avco: r.xau_g ? r.cost_rm / r.xau_g : 0,
    })),

    locked_rates: sale.locked_rates || [],
  };

  // 6️⃣ --- CALL BACKEND API ---
  frappe.call({
    method: "gold_app.api.sales.wholesale_bag_melt.save_melt_assay_sales",
    args: { payload },
    freeze: true,
    callback: function (r) {
      frappe.msgprint("Melt & Assay Sales saved successfully.");
    },
  });
}
