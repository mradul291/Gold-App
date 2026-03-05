frappe.pages["retail-inventory"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Retail Inventory",
		single_column: true,
	});

	let $body = $(page.body);

	let current_page = 1;
	let page_size = 8;

	let current_filters = {
		search: "",
		item_type: "",
		purity: "",
		status: "",
		aging: "",
	};

	let search_timeout = null;

	let html = `
	<div class="ri-container">

		<!-- HEADER STATS -->
		<div class="ri-header-card">

			<div class="ri-title">
				<span class="ri-icon">📦</span>
				<span>Retail Inventory</span>
			</div>

<div class="ri-stats">
	<div class="ri-stat">
		<div class="ri-stat-label">TOTAL ITEMS</div>
		<div class="ri-stat-value" id="ri-total-items">-</div>
	</div>

	<div class="ri-stat">
		<div class="ri-stat-label">AVAILABLE</div>
		<div class="ri-stat-value green" id="ri-available-items">-</div>
	</div>

	<div class="ri-stat">
		<div class="ri-stat-label">TOTAL GROSS WEIGHT</div>
		<div class="ri-stat-value gold" id="ri-total-weight">-</div>
	</div>

	<div class="ri-stat">
		<div class="ri-stat-label">TOTAL XAU</div>
		<div class="ri-stat-value gold" id="ri-total-xau">-</div>
	</div>

	<div class="ri-stat">
		<div class="ri-stat-label">TOTAL VALUE</div>
		<div class="ri-stat-value" id="ri-total-value">-</div>
	</div>
</div>

		</div>

		<!-- PURITY BREAKDOWN -->
		
			<div class="ri-card">
				<div class="ri-card-header ri-collapsible-header">
					<div class="ri-card-title">
						<span class="collapse-icon">▾</span>
						Purity Breakdown 📊
					</div>
				</div>

			<div class="ri-card-body" id="purity-body">

				<table class="ri-table">
					<thead>
						<tr>
							<th>PURITY</th>
							<th>NO. ITEMS</th>
							<th>GROSS WT (G)</th>
							<th>AVCO (RM/G)</th>
							<th>TOTAL COST (RM)</th>
							<th>XAU (G)</th>
							<th>AVCO XAU (RM/G)</th>
						</tr>
					</thead>

					<tbody id="ri-purity-body">
</tbody>
				</table>

			</div>
		</div>

		<!-- FILTERS -->
		<div class="ri-card">

			<div class="ri-card-body">

				<div class="ri-filters">

	<input id="ri-search" class="ri-input" placeholder="🔍  SKU, RFID, or item description">

	<select id="ri-item-type" class="ri-select">
    	<option value="">Item Type</option>
	</select>

	<select id="ri-purity" class="ri-select">
    	<option value="">Purity</option>
	</select>

	<select id="ri-status" class="ri-select">
		<option value="">Status</option>
		<option value="Available">Available</option>
		<option value="Reserved">Reserved</option>
		<option value="Sold">Sold</option>
	</select>

	<select id="ri-aging" class="ri-select">
		<option value="">Aging</option>
		<option value="0-30">0-30 days</option>
		<option value="31-60">31-60 days</option>
		<option value="61-90">61-90 days</option>
		<option value="90+">90+ days</option>
	</select>

	<button id="ri-apply-filter" class="ri-btn ri-btn-gold">Apply Filters</button>
	<button id="ri-clear-filter" class="ri-btn ri-btn-gray">Clear</button>

</div>
			</div>
		</div>

		<!-- INVENTORY TABLE -->
		<div class="ri-card">

			<div class="ri-card-header">
				<div class="ri-card-title">Inventory Items (219 Available)</div>

				<div class="ri-actions">
					<button id="ri-export" class="ri-btn ri-btn-gray">Export CSV</button>
					<button id="ri-add-item" class="ri-btn ri-btn-gold">+ Add Item</button>
				</div>
			</div>

			<div class="ri-card-body">

				<table class="ri-table inventory-table">

					<thead>
						<tr>
							<th>PHOTO</th>
							<th>SKU CODE</th>
							<th>ITEM TYPE</th>
							<th>PURITY</th>
							<th>WEIGHT (G)</th>
							<th>LENGTH/SIZE</th>
							<th>COST PRICE</th>
							<th>RFID TAG</th>
							<th>DAYS</th>
							<th>STATUS</th>
							<th>ACTIONS</th>
						</tr>
					</thead>

					<tbody id="ri-inventory-body"></tbody>


				</table>
				<!-- PAGINATION -->
				<div class="ri-pagination" id="ri-pagination"></div>

				</div>
		</div>
	</div>
	`;

	$body.html(html);

	// Collapsible Purity Section
	$(".ri-collapsible-header").on("click", function () {
		let body = $("#purity-body");
		let icon = $(this).find(".collapse-icon");

		body.slideToggle(200);

		icon.toggleClass("rotated");
	});

	// ==========================
	// Load Retail Overview Data
	// ==========================
	load_retail_overview();
	load_inventory_items();
	load_filter_dropdowns();

	function load_retail_overview() {
		frappe.call({
			method: "gold_app.api.retail.retail_inventory.get_retail_inventory_overview",
			callback: function (r) {
				if (!r.message) return;

				render_header(r.message.header);
				render_purity_table(r.message.purities);
			},
		});
	}

	function load_filter_dropdowns() {
		frappe.call({
			method: "gold_app.api.retail.retail_inventory.get_retail_filter_data",
			callback: function (r) {
				if (!r.message) return;

				populate_item_groups(r.message.item_groups);
				populate_purities(r.message.purities);
			},
		});
	}

	function populate_item_groups(groups) {
		let $select = $("#ri-item-type");
		$select.empty();
		$select.append(`<option value="">Item Type</option>`);

		groups.forEach((g) => {
			$select.append(`<option value="${g.name}">${g.name}</option>`);
		});
	}

	function populate_purities(purities) {
		let $select = $("#ri-purity");
		$select.empty();
		$select.append(`<option value="">Purity</option>`);

		purities.forEach((p) => {
			$select.append(`<option value="${p.purity_name}">${p.purity_name}</option>`);
		});
	}

	// ==========================
	// Render Header
	// ==========================
	function render_header(data) {
		$("#ri-total-items").text(data.total_items || 0);
		$("#ri-available-items").text(data.available_items || 0);
		$("#ri-total-weight").text((data.total_gross_weight || 0) + " g");
		$("#ri-total-xau").text((data.total_xau || 0) + " g");
		$("#ri-total-value").text("RM " + (data.total_value || 0).toLocaleString());
	}

	// ==========================
	// Render Purity Table
	// ==========================
	function render_purity_table(rows) {
		let $tbody = $("#ri-purity-body");
		$tbody.empty();

		if (!rows || !rows.length) {
			$tbody.append(`
			<tr>
				<td colspan="7" style="text-align:center; padding:20px;">
					No data available
				</td>
			</tr>
		`);
			return;
		}

		let total_items = 0;
		let total_weight = 0;
		let total_cost = 0;
		let total_xau = 0;

		rows.forEach((row) => {
			total_items += row.no_items || 0;
			total_weight += row.gross_weight || 0;
			total_cost += row.total_cost || 0;
			total_xau += row.xau_g || 0;

			$tbody.append(`
			<tr>
				<td><span class="badge purity-${Math.floor(row.purity)}">${row.purity}</span></td>
				<td>${row.no_items ?? "-"}</td>
				<td>${row.gross_weight}</td>
				<td>${row.avco_rm_g}</td>
				<td>${row.total_cost.toLocaleString()}</td>
				<td>${row.xau_g}</td>
				<td>${row.avco_xau_rm_g}</td>
			</tr>
		`);
		});

		// Add Total Row
		let avco_xau_total = total_cost / total_xau || 0;

		$tbody.append(`
		<tr class="total-row">
			<td>TOTAL</td>
			<td>${total_items}</td>
			<td>${total_weight.toFixed(2)}</td>
			<td>-</td>
			<td>${total_cost.toLocaleString()}</td>
			<td>${total_xau.toFixed(3)}</td>
			<td>${avco_xau_total.toFixed(2)}</td>
		</tr>
	`);
	}

	function load_inventory_items(page = 1) {
		current_page = page;

		frappe.call({
			method: "gold_app.api.retail.retail_inventory.get_retail_inventory_items",
			args: {
				page: page,
				page_size: page_size,
				filters: current_filters,
			},
			callback: function (r) {
				if (!r.message) return;

				render_inventory_table(r.message.items);
				render_pagination(r.message.total_count, r.message.page);
				update_inventory_count(r.message.total_count);
			},
		});
	}

	function render_inventory_table(items) {
		let $tbody = $("#ri-inventory-body");
		$tbody.empty();

		if (!items.length) {
			$tbody.append(`
			<tr>
				<td colspan="11" style="text-align:center;padding:20px;">
					No Retail Items Found
				</td>
			</tr>
		`);
			return;
		}

		items.forEach((item) => {
			let status_class = (item.status || "Available").toLowerCase();
			let days_class = get_days_class(item.days);

			$tbody.append(`
			<tr>
				<td>
					<div class="photo-box">
						${get_item_image(item)}
					</div>
				</td>
				<td class="sku">${item.item_code}</td>
				<td>${item.item_type}</td>
				<td><span class="badge purity-${Math.floor(item.purity)}">${item.purity}</span></td>
				<td>${item.weight}</td>
				<td>${item.length_size || "-"}</td>
				<td class="cost">RM ${Number(item.cost_price || 0).toLocaleString()}</td>
				<td class="rfid">${item.rfid_tag || "-"}</td>
				<td><span class="days-badge ${days_class}">${item.days}</span></td>
				<td><span class="status-badge ${status_class}">${item.status || "Available"}</span></td>
				<td>
					<button class="action-btn view" data-name="${item.item_code}">View</button>
					<button class="action-btn edit" data-name="${item.item_code}">Edit</button>
				</td>
			</tr>
		`);
		});
	}

	function get_days_class(days) {
		if (days <= 30) return "green";
		if (days <= 60) return "gray";
		if (days <= 90) return "yellow";
		return "red";
	}

	function render_pagination(total_items, page) {
		let total_pages = Math.ceil(total_items / page_size);
		let start = (page - 1) * page_size + 1;
		let end = Math.min(page * page_size, total_items);

		let html = `
	<div class="ri-pagination-info">
		Showing ${start}-${end} of ${total_items} items
	</div>
	<div class="ri-pagination-controls">
	`;

		// Previous
		if (page > 1) {
			html += `<button class="page-btn" data-page="${page - 1}">← Prev</button>`;
		} else {
			html += `<button class="page-btn disabled">← Prev</button>`;
		}

		// Page numbers
		for (let i = 1; i <= total_pages; i++) {
			html += `
			<button 
				class="page-btn ${i === page ? "active" : ""}"
				data-page="${i}">
				${i}
			</button>
		`;
		}

		// Next
		if (page < total_pages) {
			html += `<button class="page-btn" data-page="${page + 1}">Next →</button>`;
		} else {
			html += `<button class="page-btn disabled">Next →</button>`;
		}

		html += `</div>`;

		$("#ri-pagination").html(html);
	}

	function update_inventory_count(total) {
		$(".ri-card-title:contains('Inventory Items')").text(
			`Inventory Items (${total} Available)`,
		);
	}

	function get_item_image(item) {
		if (item.image) {
			return `<img src="${item.image}" width="40" class="item-img">`;
		}

		if (item.item_group_image) {
			return `<img src="${item.item_group_image}" width="40" class="item-img default-img">`;
		}

		return "📦";
	}

	$body.on("click", ".action-btn.view", function () {
		let item_code = $(this).data("name");
		frappe.set_route("Form", "Item", item_code);
	});

	$body.on("click", ".action-btn.edit", function () {
		let item_code = $(this).data("name");
		frappe.set_route("Form", "Item", item_code);
	});

	// ==========================
	// FILTER EVENTS
	// ==========================

	$body.on("click", "#ri-apply-filter", function () {
		current_filters.search = $("#ri-search").val().trim();
		current_filters.item_type = $("#ri-item-type").val();
		current_filters.purity = $("#ri-purity").val();
		current_filters.status = $("#ri-status").val();
		current_filters.aging = $("#ri-aging").val();

		load_inventory_items(1);
	});

	$body.on("click", "#ri-clear-filter", function () {
		current_filters = {
			search: "",
			item_type: "",
			purity: "",
			status: "",
			aging: "",
		};

		$("#ri-search").val("");
		$("#ri-item-type").val("");
		$("#ri-purity").val("");
		$("#ri-status").val("");
		$("#ri-aging").val("");

		load_inventory_items(1);
	});

	// ==========================
	// PAGINATION CLICK HANDLER
	// ==========================

	$body.on("click", ".page-btn", function () {
		if ($(this).hasClass("disabled") || $(this).hasClass("active")) return;

		let page = $(this).data("page");
		if (page) {
			load_inventory_items(page);
		}
	});

	// ==========================
	// ACTION BUTTONS
	// ==========================

	$body.on("click", "#ri-add-item", function () {
		frappe.new_doc("Item");
	});

	$body.on("click", "#ri-export", function () {
		frappe.set_route("List", "Item");
	});

	// ==========================
// REAL-TIME SEARCH
// ==========================

$body.on("input", "#ri-search", function () {

    let value = $(this).val().trim();

    // Clear previous timer
    if (search_timeout) {
        clearTimeout(search_timeout);
    }

    // Debounce: wait 400ms after typing stops
    search_timeout = setTimeout(function () {

        current_filters.search = value;
        current_page = 1;

        load_inventory_items(1);

    }, 400);
});
};
