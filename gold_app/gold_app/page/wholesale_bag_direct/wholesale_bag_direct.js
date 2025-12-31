// wholesale_bag_direct.js
frappe.pages["wholesale-bag-direct"].on_page_load = function (wrapper) {
	// -- Page Initialization --
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Wholesale Bag Direct Sale",
		single_column: true,
	});

	if (!window.WBDRefs) {
		window.WBDRefs = {
			customer_id: "",
			customer: "",
			invoice_id: "",
			log_id: "",
			total_selling_amount: 0,
		};
	}

	const urlParams = new URLSearchParams(window.location.search);
	const RESUME_LOG_ID = urlParams.get("log_id");

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
			<button class="wbd-print-btn" style="margin-left: 10px;">Print</button>
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
            <input type="time" id="posting-time">
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
		<div class="wbd-totals-row">
			<span>Total Discount (MYR)</span>
			<span class="wbd-totals-value">
				<input type="number" id="wbd-total-discount" value="0.00" min="0" class="wbd-discount-input">
			</span>
		</div>
		<div class="wbd-totals-row"><span>Total Weight Sold (g)</span><span>50.00</span></div>   <div class="wbd-totals-row"><span>Total AVCO Cost (MYR)</span><span>RM 14,275.00</span></div>
          <div class="wbd-totals-row wbd-totals-dark"><span>Total Selling Amount (MYR)</span><span>RM 14,750.00</span></div>
          <div class="wbd-totals-row"><span>Average Profit/g (RM/g)</span><span>9.50</span></div>
          <div class="wbd-totals-row wbd-totals-green"><span>Total Profit (MYR)</span><span>RM 475.00</span></div>
          <div class="wbd-totals-row"><span>Overall Profit Margin (%)</span><span>3.33%</span></div>
        </div>
      </div>
    </div>`);

	function loadResumeData(log_id) {
		frappe.call({
			method: "gold_app.api.sales.wholesale_bag_direct.get_resume_payment_data",
			args: { log_id },
			callback: (r) => {
				if (!r.message) {
					frappe.msgprint("Failed to load resume payment data.");
					return;
				}

				const d = r.message;

				// ---------------------------
				// 1. Update GLOBAL REFS
				// ---------------------------
				window.WBDRefs.log_id = d.log_id;
				window.WBDRefs.invoice_id = d.invoice_id;
				window.WBDRefs.customer_id = d.customer_id;
				window.WBDRefs.total_selling_amount = d.total_selling_amount;

				// ---------------------------
				// 2. Restore CUSTOMER fields
				// ---------------------------
				$("#customerInput").val(d.customer || "");
				$("#idNumberInput").val(d.customer_id || "");

				// -----------------------------------------------------
				// FIX: Restore selected customer for Sales Invoice flow
				// -----------------------------------------------------
				selectedCustomerId = d.customer_id;

				if (!allCustomersRaw.find((c) => c.name === d.customer_id)) {
					allCustomersRaw.unshift({
						name: d.customer_id,
						customer_name: d.customer,
						id_number: d.customer_id,
						customer_group: d.customer_type || "Wholesale",
					});
				}

				// ---------------------------
				// 3. Restore DATE & TIME
				// ---------------------------
				if (d.date) $("#sales-details-tab input[type='date']").val(d.date);
				if (d.posting_time) $("#sales-details-tab input[type='time']").val(d.posting_time);

				// ---------------------------
				// 4. Restore CUSTOMER TYPE
				// ---------------------------
				if (d.customer_type) {
					$("#customerTypeSelect").val(d.customer_type);
				}

				// ---------------------------
				// 5. Restore ITEMS TABLE
				// ---------------------------
				const $tbody = $("#sales-details-tab .wbd-table tbody");
				$tbody.empty(); // clear existing empty row

				(d.items || []).forEach((item, idx) => {
					const rowHtml = buildTableRow(idx + 1);
					$tbody.append(rowHtml);

					const $tr = $tbody.find("tr").last();

					// Apply stored data to row
					$tr.find("select.wbd-src-bag").val(item.source_bag);
					$tr.find("select.wbd-src-purity").html(getPurityOptionsHtml(item.source_bag));
					$tr.find("select.wbd-src-purity").val(item.purity);
					$tr.find("input[type='text']")
						.eq(0)
						.val(item.description || "");

					$tr.find(".wbd-weight").val(item.weight || 0);

					// FIX: Recalculate dependent fields exactly like normal flow
					const weight = parseFloat(item.weight) || 0;
					const avco = parseFloat(item.avco_rate) || 0;
					const sell = parseFloat(item.sell_rate) || 0;

					// amount = weight * avco
					$tr.find("input[type='number']")
						.eq(3)
						.val((weight * avco).toFixed(2));

					// profit per gram = sell - avco
					$tr.find("input[type='number']")
						.eq(4)
						.val((sell - avco).toFixed(2));

					// total profit
					$tr.find("input[type='number']")
						.eq(5)
						.val(((sell - avco) * weight).toFixed(2));

					const nums = $tr.find("input[type='number']");
					nums.eq(1).val(item.avco_rate || 0);
					nums.eq(2).val(item.sell_rate || 0);
					nums.eq(3).val(item.amount || 0);
					nums.eq(4).val(item.profit_per_g || 0);
					nums.eq(5).val(item.total_profit || 0);
				});

				// Recalculate UI after loading rows
				updateDocumentTotals();
				recalculateUIBagUsage();
				updateBagOverviewUI();

				// ---------------------------
				// 6. Set TOTALS from log
				// ---------------------------
				const $totals = $("#sales-details-tab .wbd-totals-card");

				// 0 = Discount (handled separately)
				if (d.total_discount !== undefined) {
					$("#wbd-total-discount").val(d.total_discount);
				}

				// 1 = Total Weight Sold
				if (d.total_weight_sold !== undefined)
					$totals
						.find(".wbd-totals-row")
						.eq(1)
						.find("span")
						.eq(1)
						.text(d.total_weight_sold);

				// 2 = Total AVCO Cost
				if (d.total_avco_cost !== undefined)
					$totals
						.find(".wbd-totals-row")
						.eq(2)
						.find("span")
						.eq(1)
						.text("RM " + d.total_avco_cost.toFixed(2));

				// 3 = Total Selling Amount
				if (d.total_selling_amount !== undefined)
					$totals
						.find(".wbd-totals-row")
						.eq(3)
						.find("span")
						.eq(1)
						.text("RM " + d.total_selling_amount.toFixed(2));

				// 4 = Average Profit/g
				if (d.average_profit_per_g !== undefined)
					$totals
						.find(".wbd-totals-row")
						.eq(4)
						.find("span")
						.eq(1)
						.text(d.average_profit_per_g.toFixed(2));

				// 5 = Total Profit
				if (d.total_profit !== undefined)
					$totals
						.find(".wbd-totals-row")
						.eq(5)
						.find("span")
						.eq(1)
						.text("RM " + d.total_profit.toFixed(2));

				// 6 = Profit Margin
				if (d.overall_profit_margin !== undefined)
					$totals
						.find(".wbd-totals-row")
						.eq(6)
						.find("span")
						.eq(1)
						.text(d.overall_profit_margin);

				// ---------------------------
				// 7. Status Chip → SAVED
				// ---------------------------
				$(".wbd-status-chip").text("Saved").addClass("saved");

				// ---------------------------
				// 8. Restore Payment Entry Data
				// ---------------------------
				paymentEntryTab.customerAdvanceBalance = d.customer_advance_balance;

				paymentEntryTab.payments = (d.payments || []).map((row) => ({
					date: frappe.datetime.str_to_user(row.payment_date),
					method: row.payment_method,
					amount: row.amount,
					reference: row.reference_no,
					status: row.status,
				}));

				paymentEntryTab.updateSummary();
				paymentEntryTab.renderPaymentHistory();

				// ---------------------------
				// 9. Switch to Payment Tab
				// ---------------------------
				setTimeout(() => {
					switchToPaymentTab();
				}, 400);
			},
		});
	}

	function getPaymentPageRefs() {
		// PRIORITY 1 — Resume Mode (WBDRefs)
		if (RESUME_LOG_ID) {
			return {
				log_id: window.WBDRefs.log_id, // resume log id
				invoice_id: window.WBDRefs.invoice_id, // resume invoice id
				total_selling_amount: window.WBDRefs.total_selling_amount,
				customer_id: window.WBDRefs.customer_id, // customer id from log
			};
		}

		// PRIORITY 2 — Normal Mode (Existing Logic)
		const totalSelling =
			parseFloat(
				$("#sales-details-tab .wbd-totals-card .wbd-totals-row")
					.eq(3)
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

	// Set current date and time using ERPNext server timezone
	const now = frappe.datetime.now_datetime(); // company timezone

	const [date, time] = now.split(" ");

	salesDetailsContainer.find("input[type='date']").val(date);
	salesDetailsContainer.find("input[type='time']").val(time.slice(0, 5));

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

				if (RESUME_LOG_ID) {
					loadResumeData(RESUME_LOG_ID);
				}
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

	// Add "Create Customer" (+) button next to Customer input

	(function addCreateCustomerButton() {
		const $wrapper = salesDetailsContainer.find(".customer-input-wrapper");
		// create button (small circle)
		const $btn = $(`
    <button type="button" id="add-customer-btn" class="wbd-add-customer-btn" title="Add Customer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#555" stroke-width="2" stroke-linecap="round"/>
        </svg>
    </button>
`);

		// ensure wrapper is positioned relative
		$wrapper.css("position", "relative");
		$wrapper.append($btn);

		// keep input padding so text doesn't go under button
		$wrapper.find("input#customerInput").css("padding-right", "36px");
	})();

	salesDetailsContainer.find("#add-customer-btn").on("click", () => {
		const dialog = new frappe.ui.Dialog({
			title: "Add New Customer",
			fields: [
				{ label: "Customer Name", fieldname: "customer_name", fieldtype: "Data", reqd: 1 },
				{
					label: "Customer Group",
					fieldname: "customer_group",
					fieldtype: "Select",
					options: ["Wholesale", "Retail", "Individual"],
					default: "Wholesale",
					reqd: 1,
				},
				{
					label: "Nationality",
					fieldname: "customer_nationality",
					fieldtype: "Select",
					options: ["Malaysian", "Others"],
					default: "Malaysian",
					reqd: 1,
				},
				{ label: "Malaysian ID", fieldname: "malaysian_id", fieldtype: "Data" },
				{ label: "Other ID Type", fieldname: "other_id_type", fieldtype: "Data" },
				{ label: "Other ID Number", fieldname: "other_id_number", fieldtype: "Data" },
				{ label: "Mobile Number", fieldname: "mobile_number", fieldtype: "Data", reqd: 1 },
				{
					label: "Mobile Number NA",
					fieldname: "mobile_number_na",
					fieldtype: "Check",
					default: 0,
				},
			],
			primary_action_label: "Save Customer",
			primary_action: async (values) => {
				// ---------- VALIDATION ----------
				// Malaysian ID validation/format
				if (values.customer_nationality === "Malaysian") {
					let digits = (values.malaysian_id || "").replace(/\D/g, "");
					if (digits && digits.length !== 12) {
						frappe.msgprint("Malaysian ID must be exactly 12 digits.");
						return;
					}
					if (digits) {
						values.malaysian_id = `${digits.slice(0, 6)}-${digits.slice(
							6,
							8
						)}-${digits.slice(8)}`;
					}
				}

				// Others → other_id_number required
				if (values.customer_nationality === "Others") {
					if (!values.other_id_number) {
						frappe.msgprint("Nationality ID is required for non-Malaysians.");
						return;
					}
				}

				// Mobile validation
				if (!values.mobile_number_na) {
					let digits = (values.mobile_number || "").replace(/\D/g, "");
					if (!digits || (digits.length !== 10 && digits.length !== 11)) {
						frappe.msgprint(
							"Mobile number must be 10 or 11 digits, or mark 'Mobile Number NA'."
						);
						return;
					}
					// format mobile
					values.mobile_number =
						digits.length === 10
							? `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6)}`
							: `${digits.slice(0, 3)}-${digits.slice(3, 7)} ${digits.slice(7)}`;
				}

				// Ensure name present
				if (!values.customer_name) {
					frappe.msgprint("Customer name is required.");
					return;
				}

				dialog.hide();

				// ---------- BACKEND INSERT: create Customer doc ----------
				try {
					const res = await frappe.call({
						method: "frappe.client.insert",
						args: {
							doc: {
								doctype: "Customer",
								customer_name: values.customer_name,
								customer_group: values.customer_group || "Wholesale",
								mobile_number: values.mobile_number || "",
								mobile_number_na: values.mobile_number_na || 0,
								// you can store other fields as custom fields if available
								customer_nationality: values.customer_nationality || "",
								malaysian_id: values.malaysian_id || "",
								other_id_type: values.other_id_type || "",
								other_id_number: values.other_id_number || "",
							},
						},
					});

					if (res && res.message) {
						const newCustomer = res.message;

						// 1) Push customer into suggestions list (using system fields)
						allCustomersRaw.unshift({
							name: newCustomer.name, // doc.name
							customer_name: newCustomer.customer_name,
							id_number: newCustomer.id_number || "", // auto-generated ID NUMBER
							customer_group: newCustomer.customer_group || "Wholesale",
						});

						// 2) Auto-select new customer in UI
						selectedCustomerId = newCustomer.name;
						$customerInput
							.val(newCustomer.customer_name)
							.data("customer-id", newCustomer.name);

						// 3) Fill ID Number field using the auto-generated field
						$("#idNumberInput").val(newCustomer.id_number || "");

						// 4) Update global reference
						window.WBDRefs.customer_id = newCustomer.name;

						frappe.show_alert({ message: "Customer added successfully." });
					} else {
						frappe.msgprint("Failed to create Customer.");
					}
				} catch (err) {
					console.error(err);
					frappe.msgprint("Error while creating customer: " + (err.message || err));
				}
			},
		});

		// Set required on load
		dialog.set_df_property("mobile_number", "reqd", 1);

		// nationality toggle logic (show/hide fields)
		function toggleNationality() {
			const nationality = dialog.get_value("customer_nationality");
			if (nationality === "Malaysian") {
				dialog.set_df_property("malaysian_id", "reqd", 1);
				dialog.get_field("malaysian_id").$wrapper.show();

				dialog.set_df_property("other_id_type", "reqd", 0);
				dialog.get_field("other_id_type").$wrapper.hide();
				dialog.set_df_property("other_id_number", "reqd", 0);
				dialog.get_field("other_id_number").$wrapper.hide();
			} else {
				dialog.set_df_property("malaysian_id", "reqd", 0);
				dialog.get_field("malaysian_id").$wrapper.hide();

				dialog.get_field("other_id_type").$wrapper.show();
				dialog.get_field("other_id_number").$wrapper.show();
				dialog.set_df_property("other_id_type", "reqd", 1);
				dialog.set_df_property("other_id_number", "reqd", 1);
			}
		}

		dialog.fields_dict.customer_nationality.$input.on("change", toggleNationality);
		setTimeout(() => toggleNationality(), 150);

		// auto-format Malaysian ID on blur
		const mid_field = dialog.get_field("malaysian_id");
		if (mid_field && mid_field.$input) {
			mid_field.$input.on("blur", () => {
				let val = mid_field.$input.val() || "";
				let digits = val.replace(/\D/g, "");
				if (!digits) return;
				if (digits.length !== 12) {
					frappe.msgprint("Malaysian ID must be exactly 12 digits.");
					return;
				}
				dialog.set_value(
					"malaysian_id",
					`${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`
				);
			});
		}

		// mobile NA toggle
		const mobile_na_field = dialog.get_field("mobile_number_na");
		if (mobile_na_field && mobile_na_field.$input) {
			mobile_na_field.$input.on("change", () => {
				const is_na = dialog.get_value("mobile_number_na");
				dialog.set_df_property("mobile_number", "reqd", is_na ? 0 : 1);
				if (is_na) dialog.set_value("mobile_number", "");
			});
		}

		// mobile auto-format on blur
		const mobile_field = dialog.get_field("mobile_number");
		if (mobile_field && mobile_field.$input) {
			mobile_field.$input.on("blur", () => {
				if (dialog.get_value("mobile_number_na")) return;
				let val = mobile_field.$input.val() || "";
				let digits = val.replace(/\D/g, "");
				if (!digits) return;
				if (digits.length !== 10 && digits.length !== 11) {
					frappe.msgprint("Mobile number must be 10 or 11 digits.");
					return;
				}
				let formatted =
					digits.length === 10
						? `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6)}`
						: `${digits.slice(0, 3)}-${digits.slice(3, 7)} ${digits.slice(7)}`;
				dialog.set_value("mobile_number", formatted);
			});
		}

		dialog.show();
	});

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

		// Row 0 = Total Discount (IGNORE in updateDocumentTotals)

		$totals
			.find(".wbd-totals-row")
			.eq(1) // Total Weight Sold
			.find("span")
			.eq(1)
			.text(totalWeight.toFixed(2));

		$totals
			.find(".wbd-totals-row")
			.eq(2) // Total AVCO Cost
			.find("span")
			.eq(1)
			.text("RM " + totalAvcoCost.toLocaleString(undefined, { minimumFractionDigits: 2 }));

		$totals
			.find(".wbd-totals-row")
			.eq(3) // Total Selling Amount
			.find("span")
			.eq(1)
			.text(
				"RM " +
					totalSelling.toLocaleString(undefined, {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})
			);

		$totals
			.find(".wbd-totals-row")
			.eq(4) // Avg Profit/g
			.find("span")
			.eq(1)
			.text(avgProfitPerGram.toFixed(2));

		$totals
			.find(".wbd-totals-row")
			.eq(5) // Total Profit
			.find("span")
			.eq(1)
			.text("RM " + totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 }));

		$totals
			.find(".wbd-totals-row")
			.eq(6) // Overall Profit Margin
			.find("span")
			.eq(1)
			.text(profitMargin.toFixed(2) + "%");
	}

	function applyDiscountEffect() {
		const discount = parseFloat($("#wbd-total-discount").val()) || 0;

		const $totals = $("#sales-details-tab .wbd-totals-card .wbd-totals-row");

		// ORIGINAL selling amount (row 3) — extracted from UI
		const originalSelling =
			parseFloat(
				$totals
					.eq(3)
					.find("span")
					.eq(1)
					.text()
					.replace(/[^\d.]/g, "")
			) || 0;

		// Adjusted Selling = originalSelling – discount
		const adjustedSelling = Math.max(originalSelling - discount, 0);

		// Update UI
		$totals
			.eq(3)
			.find("span")
			.eq(1)
			.text("RM " + adjustedSelling.toLocaleString(undefined, { minimumFractionDigits: 2 }));

		// Recalculate Profit & Margin using adjusted selling
		const totalProfit =
			adjustedSelling -
			(parseFloat(
				$totals
					.eq(2)
					.find("span")
					.eq(1)
					.text()
					.replace(/[^\d.]/g, "")
			) || 0);

		$totals
			.eq(5)
			.find("span")
			.eq(1)
			.text("RM " + totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 }));

		const margin = adjustedSelling ? (totalProfit / adjustedSelling) * 100 : 0;
		$totals
			.eq(6)
			.find("span")
			.eq(1)
			.text(margin.toFixed(2) + "%");
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
		data.total_discount = parseFloat($("#wbd-total-discount").val()) || 0;
		data.total_weight_sold = parseFloat($totals.eq(1).find("span").eq(1).text());
		data.total_avco_cost = parseFloat(
			$totals
				.eq(2)
				.find("span")
				.eq(1)
				.text()
				.replace(/[^\d.]/g, "")
		);
		data.total_selling_amount = parseFloat(
			$totals
				.eq(3)
				.find("span")
				.eq(1)
				.text()
				.replace(/[^\d.]/g, "")
		);
		data.average_profit_per_g = parseFloat($totals.eq(4).find("span").eq(1).text());
		data.total_profit = parseFloat(
			$totals
				.eq(5)
				.find("span")
				.eq(1)
				.text()
				.replace(/[^\d.]/g, "")
		);
		data.overall_profit_margin = $totals.eq(6).find("span").eq(1).text();

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
					// UX Hint: Ask user to create invoice before payment
					frappe.msgprint("Please create the invoice before making payments.");

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
		const posting_date = salesDetailsContainer.find("input[type='date']").val() || null;
		const posting_time = $("#posting-time").val() || null;

		frappe.call({
			method: "gold_app.api.sales.wholesale_bag_direct.create_sales_invoice",
			args: {
				customer: customer,
				items: JSON.stringify(items_data),
				discount_amount: parseFloat($("#wbd-total-discount").val()) || 0,
				posting_date: posting_date,
				posting_time: posting_time,
			},
			callback: function (r) {
				salesDetailsContainer
					.find(".wbd-invoice-btn")
					.prop("disabled", false)
					.text("Create Invoice");
				if (r.message && r.message.status === "success") {
					const salesInvoice = r.message.sales_invoice;

					// Save invoice in current session
					currentSalesInvoiceId = salesInvoice;

					// IMPORTANT – update global references for Payment Entry
					window.WBDRefs.invoice_id = salesInvoice;

					window.WBDRefs.total_selling_amount =
						parseFloat(
							$("#sales-details-tab .wbd-totals-card .wbd-totals-row")
								.eq(3)
								.find("span")
								.eq(1)
								.text()
								.replace(/[^\d.]/g, "")
						) || 0;

					// Force Payment Tab to use fresh totals
					paymentEntryTab.total = window.WBDRefs.total_selling_amount;
					paymentEntryTab.paid = 0;
					paymentEntryTab.updateSummary();

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

	// Print Button Event
	salesDetailsContainer.find(".wbd-print-btn").on("click", function () {
		const invoiceId = currentSalesInvoiceId || window.WBDRefs.invoice_id;

		if (!invoiceId) {
			frappe.msgprint("Please create the Sales Invoice before printing.");
			return;
		}

		const encodedDocName = encodeURIComponent(invoiceId);
		const url = `/app/print/Sales%20Invoice/${encodedDocName}`;

		window.open(url, "_blank");
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

	// Calculate Selling Amount after Discount
	salesDetailsContainer.on("input", "#wbd-total-discount", function () {
		updateDocumentTotals(); // recalc original totals
		applyDiscountEffect(); // apply discount afterwards
		markNotSaved();
	});
	salesDetailsContainer.on("blur", "#wbd-total-discount", function () {
		let val = parseFloat($(this).val()) || 0;
		$(this).val(val.toFixed(2));
	});
};
