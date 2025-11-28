// wholesale_bag_direct.js
frappe.pages["wholesale-bag-direct"].on_page_load = function (wrapper) {
	// -- Page Initialization --
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Wholesale Bag Direct Sale",
		single_column: true,
	});

	let bagOverviewData = [];
	const uiBagUsageMap = {};
	let currentLogId = null;
	let currentSalesInvoiceId = null;

	// Add tabs HTML and containers for each tab
	$(page.body).html(`
  	<ul class="nav nav-tabs" style="margin-bottom: 1em;">
  		<li class="nav-item"><a class="nav-link active" href="#" id="tab-sales-details">Sales Details</a></li>
  		<li class="nav-item"><a class="nav-link" href="#" id="tab-payment-entry">Payment Entry</a></li>
  	</ul>
  	<div id="tab-container">
  		<div id="sales-details-tab"></div>
  		<div id="payment-entry-tab" style="display:none;"></div>
  	</div>
	`);

	// -- Page Body Layout --
	$("#sales-details-tab").html(`
    <!-- Status and Save Button -->
    <div class="wbd-meta-row" style="display: flex; align-items: center; justify-content: space-between;">
    	<span class="wbd-status-chip">Not Saved</span>
    	<div>
    		<button class="wbd-save-btn">Save</button>
    		<button class="wbd-invoice-btn" style="margin-left: 10px;">Create Invoice</button>
    	</div>
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
            <input type="date" value="">
          </div>
          <div>
            <label>Posting Time <span class="wbd-required">*</span></label>
            <input type="time" value="">
          </div>
        </div>
        <!-- Row 2: Customer Type, Customer, Payment Method -->
        <div class="wbd-form-row">
          <div>
          	<label>Customer Type</label>
          	<select id="customerTypeSelect">
          		<option value="Individual">Individual</option>
          		<option value="Wholesale">Wholesale</option>
				<option value="Retail">Retail</option>
          	</select>
          </div>
          <div>
          	<label>Customer <span class="wbd-required">*</span></label>
          	<div class="customer-input-wrapper" style="position: relative;">
          		<input type="text" id="customerInput" placeholder="Select or search customer">
          		<div id="customerSuggestions" class="dropdown-suggestions" style="display:none;"></div>
          	</div>
          </div>
         <div>
            <label>ID Number</label>
            <input type="text" id="idNumberInput" placeholder="NRIC / Passport / Company Reg">
          </div>
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
              <th class="wbd-purity-col">Purity</th>
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

	function getPaymentPageRefs() {
		const totalSelling =
			parseFloat(
				$("#sales-details-tab .wbd-totals-card .wbd-totals-row")
					.eq(2)
					.find("span")
					.eq(1)
					.text()
					.replace(/[^\d.]/g, "")
			) || 0;

		const customer_id = $("#sales-details-tab #idNumberInput").val() || "";

		return {
			log_id: currentLogId,
			invoice_id: currentSalesInvoiceId,
			total_selling_amount: totalSelling,
			customer_id: customer_id,
		};
	}

	const salesDetailsContainer = $("#sales-details-tab");
	const paymentEntryTab = new WholesaleBagDirectPayment(
		"#payment-entry-tab",
		getPaymentPageRefs
	);

	$("#tab-sales-details").on("click", function (e) {
		e.preventDefault();
		$(this).addClass("active");
		$("#tab-payment-entry").removeClass("active");
		$("#sales-details-tab").show();
		$("#payment-entry-tab").hide();
	});

	$("#tab-payment-entry").on("click", function (e) {
		e.preventDefault();

		const status = salesDetailsContainer.find(".wbd-status-chip").text();
		const customer = salesDetailsContainer.find("#customerInput").val().trim();

		// 1. Customer validation
		if (!customer) {
			frappe.msgprint("Please select a customer before going to Payment Entry.");
			return;
		}

		// 2. If already saved → directly switch
		if (status === "Saved") {
			switchToPaymentTab();
			return;
		}

		// 3. Auto-save → then switch
		saveWholesaleDirectSale(true, () => {
			switchToPaymentTab();
		});
	});

	// Set current date and time on page load
	const now = new Date();
	const padZero = (n) => n.toString().padStart(2, "0");

	const currentDate = `${now.getFullYear()}-${padZero(now.getMonth() + 1)}-${padZero(
		now.getDate()
	)}`;
	const currentTime = `${padZero(now.getHours())}:${padZero(now.getMinutes())}`;

	// Set values in the date and time inputs
	salesDetailsContainer.find("input[type='date']").val(currentDate);
	salesDetailsContainer.find("input[type='time']").val(currentTime);

	// Change Status to Not Saved on Any Update.
	function markNotSaved() {
		const $chip = salesDetailsContainer.find(".wbd-status-chip");
		$chip.text("Not Saved").removeClass("saved").addClass("wbd-status-chip");
	}
	// Revert to Not Saved on:
	// Any input/select change in form, any table input, or row add/remove
	salesDetailsContainer.on(
		"input change",
		".wbd-form-row input, .wbd-form-row select, .wbd-table input, .wbd-table select",
		markNotSaved
	);
	salesDetailsContainer.find(".wbd-add-row-btn, .wbd-table").on("click", markNotSaved); // Handles add/remove row buttons
	salesDetailsContainer.on("click", "#customerSuggestions .suggestion-item", markNotSaved);

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

	// Show loader in Bag Overview block
	salesDetailsContainer.find("#bagCardsRow").html(`
	<div class="loader-overlay">
	  <div class="loader"></div>
	  <p>Loading bags, please wait...</p>
	</div>
	`);

	// Fetch bag overview data from backend API and render cards & initialize table options
	frappe.call({
		method: "gold_app.api.sales.wholesale_bag_direct.get_all_bag_overview",
		callback: function (r) {
			if (r.message) {
				bagOverviewData = r.message;
				const bagCardsHtml = renderBagCards(bagOverviewData);
				salesDetailsContainer.find("#bagCardsRow").html(bagCardsHtml);
				renderItemsTableOptions();
				updateDocumentTotals();
				recalculateUIBagUsage();
				updateBagOverviewUI();
			}
		},
	});

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
				salesDetailsContainer.find("#idNumberInput").val(r.message.id_number || "");
			} else {
				salesDetailsContainer.find("#idNumberInput").val("");
			}
		} catch (err) {
			console.error("Failed to fetch ID number:", err);
		}
	}

	// Load all customers on page load for suggestions
	let allCustomersRaw = [];

	function loadCustomers(callback) {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Customer",
				fields: ["name", "customer_name", "id_number", "customer_group"],
				limit_page_length: 500,
			},
			callback: function (r) {
				allCustomersRaw = r.message || [];
				if (callback) callback();
			},
		});
	}
	loadCustomers();

	const $customerInput = salesDetailsContainer.find("#customerInput");
	const $customerSuggestions = salesDetailsContainer.find("#customerSuggestions");
	let selectedCustomerId = null;

	// Typeahead: show suggestions on input
	$customerInput.on("input", function () {
		const query = $(this).val().toLowerCase().trim();
		if (!query) {
			$customerSuggestions.hide();
			return;
		}
		// Grab selected type, fallback to "Individual" if somehow blank
		const selectedType = $("#customerTypeSelect").val() || "Individual";
		// Filter customer base by group, then by search string
		const filtered = allCustomersRaw
			.filter((c) => c.customer_group === selectedType)
			.filter((c) => c.customer_name.toLowerCase().includes(query))
			.slice(0, 10);

		$customerSuggestions.empty();

		if (filtered.length === 0) {
			$customerSuggestions.append('<div class="no-results">No customers found</div>').show();
			return;
		}

		filtered.forEach((c) => {
			const display = `${c.customer_name}${c.id_number ? " - " + c.id_number : ""}`;
			$customerSuggestions.append(
				`<div class="suggestion-item" data-id="${c.name}" data-name="${c.customer_name}">${display}</div>`
			);
		});
		$customerSuggestions.show();
	});

	// When a suggestion is clicked, fill the input, store ID, and fetch ID Number
	$customerSuggestions.on("click", ".suggestion-item", function () {
		const name = $(this).data("name");
		selectedCustomerId = $(this).data("id");
		$customerInput.val(name);
		$customerSuggestions.hide();

		// Optional: fetch and fill ID number field if needed
		fetchCustomerIDNumber(selectedCustomerId);
	});

	// Hide suggestions when focus lost
	$customerInput.on("blur", function () {
		setTimeout(() => $customerSuggestions.hide(), 150);
	});
	$customerInput.on("focus", function () {
		if ($customerSuggestions.children().length > 0) $customerSuggestions.show();
	});

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
		const $rows = salesDetailsContainer.find(".wbd-table tbody tr");
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

		salesDetailsContainer.find(".wbd-table tbody tr").each(function () {
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
		const $totals = salesDetailsContainer.find(".wbd-totals-card");
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

	function recalculateUIBagUsage() {
		Object.keys(uiBagUsageMap).forEach((k) => delete uiBagUsageMap[k]);
		salesDetailsContainer.find(".wbd-table tbody tr").each(function () {
			const bag = $(this).find("select.wbd-src-bag").val();
			const purity = $(this).find("select.wbd-src-purity").val();
			const weight = parseFloat($(this).find(".wbd-weight").val()) || 0;
			if (bag && purity) {
				const key = bag + "::" + purity;
				uiBagUsageMap[key] = (uiBagUsageMap[key] || 0) + weight;
			}
		});
	}

	function updateBagOverviewUI() {
		bagOverviewData.forEach((bag) => {
			const $bagCard = salesDetailsContainer
				.find(`#bagCardsRow .wbd-bag-card .wbd-bag-id:contains("${bag.bag_id}")`)
				.closest(".wbd-bag-card");

			if ($bagCard.length) {
				let uiBagTotal = 0; // recomputed total for this bag

				$bagCard.find(".wbd-bag-card-details .wbd-bag-purity-row").each(function () {
					const $row = $(this);
					const purity = $row.find(".wbd-bag-purity").text();
					const key = bag.bag_id + "::" + purity;

					const purityData = bag.purities.find((p) => p.purity === purity) || {};
					const originalWeight = purityData.weight || 0;
					const rate = purityData.rate || 0;

					const usedWeight = uiBagUsageMap[key] || 0;
					const shownWeight = Math.max(originalWeight - usedWeight, 0);

					// update weight text
					$row.find(".wbd-bag-weight").text(shownWeight.toFixed(2) + "g");

					// accumulate total = shownWeight * rate
					uiBagTotal += shownWeight * rate;
				});

				// update bag total text on card header (UI only)
				$bagCard.find(".wbd-bag-total").text(
					"RM " +
						uiBagTotal.toLocaleString(undefined, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
						})
				);
			}
		});
	}

	function saveWholesaleDirectSale(autoSave = false, afterSave = null) {
		// Validate customer
		let customerName = salesDetailsContainer.find("#customerInput").val().trim();
		if (!customerName) {
			if (!autoSave) frappe.msgprint("Please select a customer before saving.");
			return;
		}

		// Build Data Object (shared logic)
		const data = {};

		data.series =
			salesDetailsContainer.find("select:contains('WBS-DDMMYY-')").val() || "WBS-DDMMYY-";
		data.date = salesDetailsContainer.find("input[type='date']").val();
		data.posting_time = salesDetailsContainer.find("input[type='time']").val();
		data.customer_type = salesDetailsContainer.find("#customerTypeSelect").val();
		data.customer = customerName;
		data.payment_method = salesDetailsContainer.find(".wbd-form-row select").eq(2).val();
		data.id_number = salesDetailsContainer.find("#idNumberInput").val();

		const $totals = salesDetailsContainer.find(".wbd-totals-card .wbd-totals-row");
		data.total_weight_sold = parseFloat($totals.eq(0).find("span").eq(1).text());
		data.total_avco_cost = parseFloat(
			$totals
				.eq(1)
				.find("span")
				.eq(1)
				.text()
				.replace(/[^\d.]/g, "")
		);
		data.total_selling_amount = parseFloat(
			$totals
				.eq(2)
				.find("span")
				.eq(1)
				.text()
				.replace(/[^\d.]/g, "")
		);
		data.average_profit_per_g = parseFloat($totals.eq(3).find("span").eq(1).text());
		data.total_profit = parseFloat(
			$totals
				.eq(4)
				.find("span")
				.eq(1)
				.text()
				.replace(/[^\d.]/g, "")
		);
		data.overall_profit_margin = $totals.eq(5).find("span").eq(1).text();

		data.items = [];
		salesDetailsContainer.find(".wbd-table tbody tr").each(function () {
			const $tr = $(this);
			data.items.push({
				source_bag: $tr.find("select.wbd-src-bag").val() || "",
				purity: $tr.find("select.wbd-src-purity").val() || "",
				description: $tr.find("input[type='text']").eq(0).val() || "",
				weight: parseFloat($tr.find(".wbd-weight").val()) || 0,
				avco_rate: parseFloat($tr.find("input[type='number']").eq(1).val()) || 0,
				sell_rate: parseFloat($tr.find("input[type='number']").eq(2).val()) || 0,
				amount: parseFloat($tr.find("input[type='number']").eq(3).val()) || 0,
				profit_per_g: parseFloat($tr.find("input[type='number']").eq(4).val()) || 0,
				total_profit: parseFloat($tr.find("input[type='number']").eq(5).val()) || 0,
			});
		});

		// Show saving state only for manual save
		if (!autoSave) {
			salesDetailsContainer.find(".wbd-save-btn").prop("disabled", true).text("Saving...");
		}

		frappe.call({
			method: "gold_app.api.sales.wholesale_bag_direct.create_wholesale_bag_direct_sale",
			type: "POST",
			args: { data },
			callback: function (r) {
				if (r.message && r.message.status === "success") {
					const $chip = salesDetailsContainer.find(".wbd-status-chip");
					currentLogId = r.message.name;
					$chip.text("Saved").removeClass().addClass("wbd-status-chip saved");
					// Success alert for creating Wholesale Bag Direct Sale
					frappe.show_alert({
						message: "Sale Saved: " + r.message.name,
						indicator: "green",
					});

					// Run callback if provided (used for auto-save)
					if (afterSave) afterSave();
				} else {
					if (!autoSave) {
						frappe.msgprint("Failed to save document.");
					}
				}

				if (!autoSave) {
					salesDetailsContainer
						.find(".wbd-save-btn")
						.prop("disabled", false)
						.text("Save");
				}
			},
		});
	}

	function switchToPaymentTab() {
		$("#tab-payment-entry").addClass("active");
		$("#tab-sales-details").removeClass("active");
		$("#sales-details-tab").hide();
		$("#payment-entry-tab").show();
		paymentEntryTab.show();
	}

	salesDetailsContainer.on("change", ".wbd-table select.wbd-src-bag", function () {
		const $tr = $(this).closest("tr");
		const selectedBagId = $(this).val();
		$tr.find("select.wbd-src-purity").html(getPurityOptionsHtml(selectedBagId));
		$tr.find(".wbd-weight").val("0.00").attr("max", 0);
		updateDocumentTotals();
		recalculateUIBagUsage();
		updateBagOverviewUI();
	});

	// When Purity changes, update max allowed weight, reset weight input, and set AVCO rate
	salesDetailsContainer.on("change", ".wbd-table select.wbd-src-purity", function () {
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
		recalculateUIBagUsage();
		updateBagOverviewUI();
	});

	// Validate weight input not to exceed max allowed
	salesDetailsContainer.on("input", ".wbd-table .wbd-weight", function () {
		const maxWeight = Number($(this).attr("max")) || 0;
		let val = parseFloat($(this).val()) || 0;
		if (val > maxWeight) {
			$(this).val(maxWeight);
		}
		updateDocumentTotals();
		recalculateUIBagUsage();
		updateBagOverviewUI();
	});

	// Listen for any change in any number field in items table rows
	salesDetailsContainer.on("input", ".wbd-table input[type='number']", function () {
		updateDocumentTotals();
		recalculateUIBagUsage();
		updateBagOverviewUI();
	});

	salesDetailsContainer.on(
		"input",
		".wbd-table input[type='number'], .wbd-table select.wbd-src-bag, .wbd-table select.wbd-src-purity",
		function () {
			const $tr = $(this).closest("tr"); // ✔ correct

			const weight = parseFloat($tr.find(".wbd-weight").val()) || 0;
			const avcoRate = parseFloat($tr.find("input[type='number']").eq(1).val()) || 0;
			const sellRate = parseFloat($tr.find("input[type='number']").eq(2).val()) || 0;

			// Auto-calculate Amount (MYR)
			$tr.find("input[type='number']")
				.eq(3)
				.val((weight * avcoRate).toFixed(2));

			// Auto-calculate Profit/g (RM/g)
			$tr.find("input[type='number']")
				.eq(4)
				.val((sellRate - avcoRate).toFixed(2));

			// Auto-calculate Total Profit (MYR)
			$tr.find("input[type='number']")
				.eq(5)
				.val(((sellRate - avcoRate) * weight).toFixed(2));

			// Update totals and bag UI
			updateDocumentTotals();
			recalculateUIBagUsage();
			updateBagOverviewUI();
		}
	);

	// Add Row button event
	salesDetailsContainer.find(".wbd-add-row-btn").on("click", function () {
		const $tbody = salesDetailsContainer.find(".wbd-table tbody");
		$tbody.append(buildTableRow($tbody.children().length + 1));
		renderItemsTableOptions();
		updateDocumentTotals();
		recalculateUIBagUsage();
		updateBagOverviewUI();
	});

	// Remove row event
	salesDetailsContainer.on("click", ".wbd-table .wbd-row-remove", function () {
		$(this).closest("tr").remove();
		// Re-number remaining rows
		salesDetailsContainer.find(".wbd-table tbody tr").each(function (index) {
			$(this)
				.find("td:nth-child(2)")
				.text(index + 1);
		});
		renderItemsTableOptions();
		updateDocumentTotals();
		recalculateUIBagUsage();
		updateBagOverviewUI();
	});

	// Save Button Event
	salesDetailsContainer.find(".wbd-save-btn").on("click", function () {
		saveWholesaleDirectSale(false, null);
	});

	// Sales Invoice Button Event
	salesDetailsContainer.find(".wbd-invoice-btn").on("click", function () {
		let customerId = null;
		let inputName = $customerInput.val().trim();
		let match = allCustomersRaw.find((c) => c.customer_name === inputName);

		if (!match) {
			frappe.msgprint("Please select a Customer.");
			return;
		}
		customerId = match.name;

		let customer = selectedCustomerId;
		let items_data = [];

		salesDetailsContainer.find(".wbd-table tbody tr").each(function () {
			const $tr = $(this);
			const purity = $tr.find("select.wbd-src-purity").val() || "";
			const item_code = purity ? `Unsorted-${purity}` : "";
			const source_bag = $tr.find("select.wbd-src-bag").val() || "";
			const qty = parseFloat($tr.find(".wbd-weight").val()) || 0;
			const rate = parseFloat($tr.find("input[type='number']").eq(2).val()) || 0;

			items_data.push({
				item_code: item_code,
				qty: qty,
				weight_per_unit: qty,
				rate: rate,
				purity: purity,
				warehouse: source_bag,
			});
		});

		if (salesDetailsContainer.find(".wbd-status-chip").text() !== "Saved") {
			frappe.msgprint("Please save the document before creating a Sales Invoice.");
			return;
		}
		if (!customer || !items_data.length) {
			frappe.msgprint("Customer and at least one item are required for Sales Invoice.");
			return;
		}

		salesDetailsContainer.find(".wbd-invoice-btn").prop("disabled", true).text("Creating...");

		frappe.call({
			method: "gold_app.api.sales.wholesale_bag_direct.create_sales_invoice",
			args: {
				customer: customer,
				items: JSON.stringify(items_data),
			},
			callback: function (r) {
				salesDetailsContainer
					.find(".wbd-invoice-btn")
					.prop("disabled", false)
					.text("Create Invoice");
				if (r.message && r.message.status === "success") {
					const salesInvoice = r.message.sales_invoice;
					currentSalesInvoiceId = salesInvoice;
					frappe.show_alert({
						message: "Sales Invoice Created: " + salesInvoice,
						indicator: "green",
					});
					setTimeout(() => {
						$("#tab-payment-entry").click();
					}, 300);
				} else {
					frappe.msgprint({
						message: "Failed to create Sales Invoice.",
						title: "Error",
						indicator: "red",
					});
				}
			},
		});
	});

	// Bag Overview Expand/Collapse
	salesDetailsContainer.on("click", "#toggleBagOverview", function () {
		const $icon = $(this).find(".wbd-collapsible-icon");
		const $cards = salesDetailsContainer.find("#bagCardsRow");
		if ($cards.is(":visible")) {
			$cards.slideUp(190);
			$icon.css("transform", "rotate(-90deg)");
		} else {
			$cards.slideDown(190);
			$icon.css("transform", "rotate(0deg)");
		}
	});
};
