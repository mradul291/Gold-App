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
                <div id="wbdm-bag-list" class="wbdm-grid"></div>
            </div>
        </div>
    `);

  frappe.require("/assets/gold_app/css/wholesale_bag_melt.css");

  frappe.call({
    method: "gold_app.api.sales.wholesale_bag_melt.get_bag_overview",
    callback: function (r) {
      if (r.message) {
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
// SHOW GLOBAL SHELL + TABS
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
                <div id="wbd-content" class="wbm-main-card"></div>
            </div>

        </div>
    `);

  // default tab
  loadTabContent("bag_summary");
  $(`.wbm-tab-item[data-tab="bag_summary"]`).addClass("wbm-tab-active");

  $(".wbm-tab-item").on("click", function () {
    $(".wbm-tab-item").removeClass("wbm-tab-active");
    $(this).addClass("wbm-tab-active");

    const tab = $(this).data("tab");
    loadTabContent(tab);
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

  frappe.require(path, () => {
    if (window.WBMComponents && window.WBMComponents[tabName]) {
      window.WBMComponents[tabName]($("#wbd-content"), WBMState);
    }
  });
}

function getTodayDate() {
  const d = new Date();
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}
