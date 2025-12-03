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

	// Static Bag List (as per screenshot)
	WBMState.bag_list = [
		{
			bag_id: "BAG-001",
			total_weight: 740,
			xau_g: 668.37,
			avg_purity: 903.5,
			total_cost: 45200.0,
			cost_per_gram: 61.08,
		},
		{
			bag_id: "BAG-002",
			total_weight: 1250,
			xau_g: 1100.5,
			avg_purity: 880.4,
			total_cost: 74500.0,
			cost_per_gram: 59.6,
		},
		{
			bag_id: "BAG-003",
			total_weight: 450,
			xau_g: 380.2,
			avg_purity: 844.9,
			total_cost: 25800.0,
			cost_per_gram: 57.33,
		},
		{
			bag_id: "BAG-004",
			total_weight: 920,
			xau_g: 850.4,
			avg_purity: 924.3,
			total_cost: 57500.0,
			cost_per_gram: 62.5,
		},
		{
			bag_id: "BAG-005",
			total_weight: 2100,
			xau_g: 1950.8,
			avg_purity: 929.0,
			total_cost: 132000.0,
			cost_per_gram: 62.86,
		},
	];

	renderBagGrid(WBMState.bag_list);
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
                    <strong class="wbdm-blue">${fmtNumber(bag.xau_g, 2)}g</strong>
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

			// Static for now — will later bind with backend
			WBMState.bag_summary = {
				source_bag: bagId,
				total_weight_g: 740,
				pure_gold_xau_g: 668.37,
				average_purity: 903.5,
				total_cost_basis: 45200,
				cost_per_gram: 61.08,
				record_id: "MELT-2024-001",
				record_date: "10 Nov 2024",
			};

			WBMState.bag_items = [
				{
					purity: "999.9",
					weight_g: 100,
					xau_g: 99.99,
					cost_rm: 6500.0,
					cost_per_g_rm: 65.0,
				},
				{
					purity: "999",
					weight_g: 50,
					xau_g: 49.95,
					cost_rm: 3200.0,
					cost_per_g_rm: 64.0,
				},
				{
					purity: "916",
					weight_g: 500,
					xau_g: 458.0,
					cost_rm: 29000.0,
					cost_per_g_rm: 58.0,
				},
				{
					purity: "835",
					weight_g: 58,
					xau_g: 48.43,
					cost_rm: 3100.0,
					cost_per_g_rm: 53.45,
				},
				{
					purity: "375",
					weight_g: 32,
					xau_g: 12.0,
					cost_rm: 3400.0,
					cost_per_g_rm: 106.25,
				},
			];

			showBagSummaryUI();
		});
}

// ==============================================
// SHOW GLOBAL SHELL + TABS
// ==============================================
function showBagSummaryUI() {
	$("#wbdm-root").html(`
        <div class="wbm-page-shell">

            <!-- HEADER -->
            <div class="wbm-top-bar">
                <div class="wbm-top-bar-inner">
                    <div class="wbm-top-title-block">
                        <div class="wbm-top-title">MELT & ASSAY RECORD</div>
                        <div class="wbm-top-sub">
                            Record ID: ${WBMState.bag_summary.record_id} |
                            Date: ${WBMState.bag_summary.record_date} |
                            Selected Bag: ${WBMState.selected_bag}
                        </div>
                    </div>

                    <div class="wbm-top-actions">
                        <span class="wbm-status-pill wbm-status-draft">DRAFT</span>
                        <button class="wbm-save-btn">SAVE</button>
                    </div>
                </div>

                <!-- TABS -->
                <div class="wbm-tabs-inner">
                    <div class="wbm-tab-item" data-tab="bag_summary">Bag Summary</div>
                    <div class="wbm-tab-item" data-tab="melting_assay">Melting & Assay</div>
                    <div class="wbm-tab-item" data-tab="buyer_sale">Buyer & Sale</div>
                    <div class="wbm-tab-item" data-tab="metrics">Metrics</div>
                </div>
            </div>

            <!-- TAB CONTENT -->
            <div class="wbm-page-body">
                <div id="wbd-content" class="wbm-main-card"></div>
            </div>

        </div>
    `);

	// Load default tab (Bag Summary)
	loadTabContent("bag_summary");
	$(`.wbm-tab-item[data-tab="bag_summary"]`).addClass("wbm-tab-active");

	// Tab switching logic
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
