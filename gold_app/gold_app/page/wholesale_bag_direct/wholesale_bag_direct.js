// wholesale_bag_direct.js
frappe.pages["wholesale-bag-direct"].on_page_load = function (wrapper) {
	// -- Page Initialization --
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Wholesale Bag Direct Sale",
		single_column: true,
	});

	let bagOverviewData = [];

	// -- Page Body Layout --
	$(page.body).html(`
    <!-- Status and Save Button -->
    <div class="wbd-meta-row">
      <span class="wbd-status-chip">Not Saved</span>
      <button class="btn btn-dark wbd-save-btn">Save</button>
    </div>

    <div class="wbd-main-container">
      <!-- ===== Form Controls Section ===== -->
      <div class="wbd-form-section">
        <!-- Row 1: Series, Date, Posting Time -->
        <div class="wbd-form-row">
          <div>
            <label>Series <span class="wbd-required">*</span></label>
            <select>
              <option>WBS-DDMMYY-</option>
            </select>
          </div>
          <div>
            <label>Date <span class="wbd-required">*</span></label>
            <input type="date" value="2025-11-12">
          </div>
          <div>
            <label>Posting Time <span class="wbd-required">*</span></label>
            <input type="time" value="14:04">
          </div>
        </div>
        <!-- Row 2: Customer Type, Customer, Payment Method -->
        <div class="wbd-form-row">
          <div>
            <label>Customer Type</label>
            <select>
              <option>Individual</option>
            </select>
          </div>
          <div>
            <label>Customer <span class="wbd-required">*</span></label>
            <input type="text" id="customerInput" list="customerOptions" placeholder="Select or search customer">
            <datalist id="customerOptions"></datalist>
          </div>
          <div>
            <label>Payment Method <span class="wbd-required">*</span></label>
            <select>
              <option>Cash</option>
            </select>
          </div>
        </div>
        <!-- Row 3: ID Number (full width) -->
        <div class="wbd-form-row">
          <div>
            <label>ID Number</label>
            <input type="text" id="idNumberInput" placeholder="NRIC / Passport / Company Reg">
          </div>
          <div></div>
          <div></div>
        </div>
      </div>

      <!-- ===== Bag Overview Section ===== -->
      <div class="wbd-bag-overview-block">
        <div class="wbd-bag-overview-header">
          <span class="wbd-collapsible-btn" id="toggleBagOverview">
            <span class="wbd-collapsible-icon">&#9660;</span> Bag Overview
          </span>
          <label class="wbd-showbags-label">
            <input type="checkbox" checked /> Show all available bags
          </label>
        </div>
        <div class="wbd-bag-cards-row" id="bagCardsRow"></div>
      </div>

      <!-- ===== Items Table Section ===== -->
      <div class="wbd-table-block">
        <span class="wbd-table-title">Items</span>
        <table class="wbd-table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>No.</th>
              <th>Source Bag</th>
              <th>Purity</th>
              <th>Description</th>
              <th>Weight (g)</th>
              <th>AVCO (RM/g)</th>
              <th>Sell Rate (RM/g)</th>
              <th>Amount (MYR)</th>
              <th>Profit/g (RM/g)</th>
              <th>Total Profit (MYR)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="checkbox"></td>
              <td>1</td>
              <td><select class="wbd-src-bag">${getBagOptionsHtml()}</select></td>
              <td><select class="wbd-src-purity"><option value="">---</option></select></td>
              <td><input type="text" placeholder="Optional notes"></td>
              <td><input type="number" class="wbd-weight" min="0" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><input type="number" value="0.00"></td>
              <td><button class="wbd-row-remove">&times;</button></td>
            </tr>
          </tbody>
        </table>
        <button class="btn wbd-add-row-btn">+ Add Row</button>
      </div>

      <!-- ===== Document Totals Section ===== -->
      <div class="wbd-totals-block">
        <span class="wbd-totals-title">Document Totals</span>
        <div class="wbd-totals-card">
          <div class="wbd-totals-row"><span>Total Weight Sold (g)</span><span>50.00</span></div>
          <div class="wbd-totals-row"><span>Total AVCO Cost (MYR)</span><span>RM 14,275.00</span></div>
          <div class="wbd-totals-row wbd-totals-dark"><span>Total Selling Amount (MYR)</span><span>RM 14,750.00</span></div>
          <div class="wbd-totals-row"><span>Average Profit/g (RM/g)</span><span>9.50</span></div>
          <div class="wbd-totals-row wbd-totals-green"><span>Total Profit (MYR)</span><span>RM 475.00</span></div>
          <div class="wbd-totals-row"><span>Overall Profit Margin (%)</span><span>3.33%</span></div>
        </div>
      </div>
    </div>`);

	// Function to build dynamic bag card HTML
	function renderBagCards(bags) {
		let html = "";
		bags.forEach((bag) => {
			let purityRows = bag.purities
				.map(
					(purity) => `
          <div class="wbd-bag-purity-row">
            <span class="wbd-bag-purity">${purity.purity}</span>
            <span class="wbd-bag-weight">${purity.weight}g</span>
            <span class="wbd-bag-rm">RM ${purity.rate}/g</span>
          </div>`
				)
				.join("");

			html += `
        <div class="wbd-bag-card">
          <div class="wbd-bag-card-top">
            <span class="wbd-bag-id">${bag.bag_id}</span>
            <span class="wbd-bag-total">RM ${bag.bag_total.toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})}</span>
          </div>
          <div class="wbd-bag-card-details">${purityRows}</div>
        </div>`;
		});
		return html;
	}

	// Fetch bag overview data from backend API and render cards & initialize table options
	frappe.call({
		method: "gold_app.api.sales.wholesale_bag_direct.get_all_bag_overview",
		callback: function (r) {
			if (r.message) {
				bagOverviewData = r.message;
				const bagCardsHtml = renderBagCards(bagOverviewData);
				$("#bagCardsRow").html(bagCardsHtml);
				renderItemsTableOptions();
				updateDocumentTotals();
			}
		},
	});

	// Customer List functions
	async function loadCustomerList() {
		try {
			const r = await frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Customer",
					fields: ["name", "customer_name"],
					limit_page_length: 500,
				},
			});
			renderCustomerOptions(r.message || []);
		} catch (err) {
			console.error("Error loading customers:", err);
		}
	}

	async function fetchCustomerIDNumber(customerName) {
		try {
			const r = await frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Customer",
					fieldname: ["id_number"],
					filters: { name: customerName },
				},
			});
			if (r.message && r.message.id_number) {
				document.getElementById("idNumberInput").value = r.message.id_number;
			} else {
				document.getElementById("idNumberInput").value = "";
			}
		} catch (err) {
			console.error("Failed to fetch ID number:", err);
		}
	}

	const customerInput = document.getElementById("customerInput");
	customerInput.addEventListener("input", function () {
		let customer = this.value;
		if (customer) fetchCustomerIDNumber(customer);
	});
	customerInput.addEventListener("change", function () {
		let customer = this.value;
		if (customer) fetchCustomerIDNumber(customer);
	});

	function renderCustomerOptions(customers) {
		const list = document.getElementById("customerOptions");
		list.innerHTML = "";
		customers.forEach((c) => {
			const option = document.createElement("option");
			option.value = c.name; // actual Customer ID
			option.textContent = c.customer_name || c.name; // label shown
			list.appendChild(option);
		});
	}

	loadCustomerList();

	// Helper functions for dynamic bag and purity options in table rows
	function getBagOptionsHtml() {
		if (!bagOverviewData.length) return '<option value="">Loading...</option>';
		return (
			'<option value="">Select Bag...</option>' +
			bagOverviewData
				.map((bag) => `<option value="${bag.bag_id}">${bag.bag_id}</option>`)
				.join("")
		);
	}

	function getPurityOptionsHtml(selectedBagId) {
		const bag = bagOverviewData.find((b) => b.bag_id === selectedBagId);
		if (!bag) return '<option value="">---</option>';
		return (
			'<option value="">---</option>' +
			bag.purities
				.map(
					(p) =>
						`<option value="${p.purity}" data-weight="${p.weight}">${p.purity}</option>`
				)
				.join("")
		);
	}

	function buildTableRow(rowNum = 1) {
		return `<tr>
      <td><input type="checkbox"></td>
      <td>${rowNum}</td>
      <td><select class="wbd-src-bag">${getBagOptionsHtml()}</select></td>
      <td><select class="wbd-src-purity"><option value="">---</option></select></td>
      <td><input type="text" placeholder="Optional notes"></td>
      <td><input type="number" class="wbd-weight" min="0" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><input type="number" value="0.00"></td>
      <td><button class="wbd-row-remove">&times;</button></td>
    </tr>`;
	}

	function renderItemsTableOptions() {
		const $rows = $(".wbd-table tbody tr");
		$rows.each(function () {
			const $tr = $(this);
			const $bagSelect = $tr.find("select.wbd-src-bag");
			const $puritySelect = $tr.find("select.wbd-src-purity");

			// Refresh Source Bag dropdown preserving selection if possible
			const selectedBagId = $bagSelect.val();
			$bagSelect.html(getBagOptionsHtml());
			if (selectedBagId) $bagSelect.val(selectedBagId);

			// Refresh Purity options based on selected bag
			const selectedBagForPurity = $bagSelect.val();
			const selectedPurity = $puritySelect.val();
			$puritySelect.html(getPurityOptionsHtml(selectedBagForPurity));
			if (selectedPurity) $puritySelect.val(selectedPurity);
		});
	}

	function updateDocumentTotals() {
		let totalWeight = 0;
		let totalAvcoCost = 0;
		let totalSelling = 0;
		let totalProfit = 0;
		let profitPerGramSum = 0;
		let rowCount = 0;

		$(".wbd-table tbody tr").each(function () {
			const $row = $(this);

			// Fetch cell values (all as numbers)
			const weight = parseFloat($row.find(".wbd-weight").val()) || 0;
			const avcoRate = parseFloat($row.find("input[type='number']").eq(1).val()) || 0;
			const sellRate = parseFloat($row.find("input[type='number']").eq(2).val()) || 0;
			const amount = parseFloat($row.find("input[type='number']").eq(3).val()) || 0; // Optional
			const profitPerGram = parseFloat($row.find("input[type='number']").eq(4).val()) || 0;
			const totalProfitRow = parseFloat($row.find("input[type='number']").eq(5).val()) || 0;

			totalWeight += weight;
			totalAvcoCost += avcoRate * weight;
			totalSelling += sellRate * weight;
			totalProfit += totalProfitRow; // Or recalculate if needed
			profitPerGramSum += profitPerGram;
			rowCount += 1;
		});

		// Average Profit/g
		let avgProfitPerGram = rowCount ? profitPerGramSum / rowCount : 0;

		// Overall Profit Margin (%)
		let profitMargin = totalSelling ? (totalProfit / totalSelling) * 100 : 0;

		// Update the Totals Section
		const $totals = $(".wbd-totals-card");
		$totals.find(".wbd-totals-row").eq(0).find("span").eq(1).text(totalWeight.toFixed(2));
		$totals
			.find(".wbd-totals-row")
			.eq(1)
			.find("span")
			.eq(1)
			.text("RM " + totalAvcoCost.toLocaleString(undefined, { minimumFractionDigits: 2 }));
		$totals
			.find(".wbd-totals-row")
			.eq(2)
			.find("span")
			.eq(1)
			.text("RM " + totalSelling.toLocaleString(undefined, { minimumFractionDigits: 2 }));
		$totals.find(".wbd-totals-row").eq(3).find("span").eq(1).text(avgProfitPerGram.toFixed(2));
		$totals
			.find(".wbd-totals-row")
			.eq(4)
			.find("span")
			.eq(1)
			.text("RM " + totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 }));
		$totals
			.find(".wbd-totals-row")
			.eq(5)
			.find("span")
			.eq(1)
			.text(profitMargin.toFixed(2) + "%");
	}

	// Events
	// When Bag changes, update purity options and reset weight input
	$(".wbd-table").on("change", "select.wbd-src-bag", function () {
		const $tr = $(this).closest("tr");
		const selectedBagId = $(this).val();
		$tr.find("select.wbd-src-purity").html(getPurityOptionsHtml(selectedBagId));
		$tr.find(".wbd-weight").val("0.00").attr("max", 0);
		updateDocumentTotals();
	});

	// When Purity changes, update max allowed weight, reset weight input, and set AVCO rate
	$(".wbd-table").on("change", "select.wbd-src-purity", function () {
		const $tr = $(this).closest("tr");
		const bagId = $tr.find("select.wbd-src-bag").val();
		const purityVal = $(this).val();
		const bag = bagOverviewData.find((b) => b.bag_id === bagId);
		const purityData = bag ? bag.purities.find((p) => p.purity === purityVal) : null;

		// Set max for weight
		$tr.find(".wbd-weight").attr("max", purityData ? purityData.weight : 0);
		$tr.find(".wbd-weight").val("0.00");

		// Set AVCO (RM/g) field — 7th input (index 6)
		$tr.find("input[type='number']")
			.eq(1)
			.val(purityData ? purityData.rate.toFixed(2) : "0.00");
		updateDocumentTotals();
	});

	// Validate weight input not to exceed max allowed
	$(".wbd-table").on("input", ".wbd-weight", function () {
		const maxWeight = Number($(this).attr("max")) || 0;
		let val = parseFloat($(this).val()) || 0;
		if (val > maxWeight) {
			$(this).val(maxWeight);
		}
		updateDocumentTotals();
	});

	// Listen for any change in any number field in items table rows
	$(".wbd-table").on("input", "input[type='number']", function () {
		updateDocumentTotals();
	});

	$(".wbd-table").on(
		"input",
		"input[type='number'], select.wbd-src-bag, select.wbd-src-purity",
		function () {
			$(".wbd-table tbody tr").each(function () {
				// Fetch fields for this row
				const $row = $(this);
				const weight = parseFloat($row.find(".wbd-weight").val()) || 0;
				const avcoRate = parseFloat($row.find("input[type='number']").eq(1).val()) || 0;
				const sellRate = parseFloat($row.find("input[type='number']").eq(2).val()) || 0;

				// Auto-calculate Amount (MYR)
				$row.find("input[type='number']")
					.eq(3)
					.val((weight * avcoRate).toFixed(2));

				// Auto-calculate Profit/g (RM/g)
				$row.find("input[type='number']")
					.eq(4)
					.val((sellRate - avcoRate).toFixed(2));

				// Auto-calculate Total Profit (MYR)
				$row.find("input[type='number']")
					.eq(5)
					.val(((sellRate - avcoRate) * weight).toFixed(2));
			});

			// Always update document totals after row calculation
			updateDocumentTotals();
		}
	);

	// Add Row button event
	$(".wbd-add-row-btn").on("click", function () {
		const $tbody = $(".wbd-table tbody");
		$tbody.append(buildTableRow($tbody.children().length + 1));
		renderItemsTableOptions();
		updateDocumentTotals();
	});

	// Remove row event
	$(".wbd-table").on("click", ".wbd-row-remove", function () {
		$(this).closest("tr").remove();
		// Re-number remaining rows
		$(".wbd-table tbody tr").each(function (index) {
			$(this)
				.find("td:nth-child(2)")
				.text(index + 1);
		});
		renderItemsTableOptions();
		updateDocumentTotals();
	});

	// Bag Overview Expand/Collapse
	$(document).on("click", "#toggleBagOverview", function () {
		const $icon = $(this).find(".wbd-collapsible-icon");
		const $cards = $("#bagCardsRow");
		if ($cards.is(":visible")) {
			$cards.slideUp(190);
			$icon.css("transform", "rotate(-90deg)");
		} else {
			$cards.slideDown(190);
			$icon.css("transform", "rotate(0deg)");
		}
	});
};
