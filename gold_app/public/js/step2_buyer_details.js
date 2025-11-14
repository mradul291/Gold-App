class Step2BuyerDetails {
	constructor(container, selected_bag_data, nextStepCallback, backCallback) {
		this.container = container;
		this.selected_bag_data = selected_bag_data;
		this.nextStepCallback = nextStepCallback;
		this.backCallback = backCallback;
		this.render();
	}

	async render() {
		let container = $(`
			<div class="buyer-details-container">
				<div class="loader-overlay">
					<div class="loader"></div>
					<p>Loading buyer details, please wait...</p>
				</div>
				<div class="buyer-content" style="display:none;">
					<div class="bag-details-summary"></div>
						<div class="buyer-form-block flex-row">		
<div class="form-group" style="flex: 1; min-width: 200px;">
    <label for="buyer-input">Select Buyer <span class="req">*</span></label>

    <div style="display: flex; gap: 10px; align-items: center;">

        <!-- Input Wrapper (dropdown sticks to this) -->
        <div class="buyer-input-wrapper" style="flex: 1; position: relative;">
            <input 
                type="text" 
                id="buyer-input" 
                class="input-text"
                placeholder="Search Buyer..."
                style="width: 100%;"
            />

            <!-- Suggestions positioned correctly -->
            <div id="buyer-suggestions" class="dropdown-suggestions"></div>
        </div>

        <!-- Add Buyer Button -->
        <button id="add-buyer-btn" class="btn-secondary" style="height: 38px;">
            Add Buyer
        </button>
    </div>
</div>
						<div class="form-group" style="flex: 1; min-width: 200px; margin-left: 16px;">
							<label for="sale-date">Sale Date</label>
							<input type="date" class="input-date" id="sale-date"
								value="${frappe.datetime.nowdate()}"/>
						</div>
					</div>
				</div>

				<div class="button-row">
					<button class="btn-secondary back-btn">&larr; Back</button>
					<button class="btn-primary continue-btn">Continue &rarr;</button>
				</div>
			</div>
		`);

		this.container.empty().append(container);

		// 🔹 If Step 1 passed an existing transaction, use it
		const existingTxn = this.selected_bag_data.existing_txn || null;
		if (existingTxn) {
			console.log("Loaded existing transaction:", existingTxn);

			// Prefill Buyer + Date + Summary
			this.prefilled_buyer = existingTxn.buyer;
			this.prefilled_buyer_name = existingTxn.buyer_name;
			this.prefilled_sale_date = existingTxn.sale_date;
			// Prefer reconciliation_lines (new root source)
			const recon = existingTxn.reconciliation_lines || [];

			this.prefilled_bag_summary = recon.map((r) => ({
				purity: r.purity,
				total_qty: r.claimed || r.actual || 0,
				avg_rate: r.avg_rate || 0,
				total_amount_rm: r.cost_basis || 0,
			}));
		}

		// -----------------------------
		// Fetch bag summary dynamically (or from existingTxn)
		// -----------------------------
		let bagSummary = [];
		if (existingTxn) {
			bagSummary = this.prefilled_bag_summary;
		} else {
			let res = await frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.get_warehouse_stock",
				args: { warehouse_name: this.selected_bag_data.warehouse_id },
			});
			bagSummary = (res && res.message) || [];
		}

		let totalAmount = bagSummary.reduce((s, r) => s + parseFloat(r.total_amount_rm || 0), 0);

		// Render bag summary table
		let summaryHTML = `
			<div class="bag-summary-block">
				<div class="bag-title-row">
					<span class="bag-label">Selected Bag: <b>${this.selected_bag_data.warehouse_name}</b></span>
				</div>
				<table class="summary-table">
					<thead>
						<tr>
							<th>Purity</th>
							<th>Weight (g)</th>
							<th>AVCO (RM/g)</th>
							<th>Total Amount (RM)</th>
						</tr>
					</thead>
					<tbody>
						${bagSummary
							.map(
								(r) => `
							<tr>
								<td>${r.purity}</td>
								<td>${parseFloat(r.total_qty).toFixed(2)} g</td>
								<td>RM ${parseFloat(r.avg_rate).toFixed(2)}</td>
								<td>RM ${parseFloat(r.total_amount_rm).toLocaleString("en-MY", {
									minimumFractionDigits: 2,
								})}</td>
							</tr>`
							)
							.join("")}
						<tr class="summary-total-row">
							<td><b>TOTAL</b></td>
							<td><b>${bagSummary.reduce((t, r) => t + parseFloat(r.total_qty || 0), 0).toFixed(2)} g</b></td>
							<td>-</td>
							<td><b>RM ${totalAmount.toLocaleString("en-MY", {
								minimumFractionDigits: 2,
							})}</b></td>
						</tr>
					</tbody>
				</table>
			</div>`;
		container.find(".bag-details-summary").html(summaryHTML);

		// -----------------------------
		// Fetch buyers dynamically (only Wholesale customers)
		// -----------------------------
		let buyers = await frappe.db.get_list("Customer", {
			fields: ["name", "customer_name", "id_number", "customer_group"],
			filters: { customer_group: "Wholesale" },
		});

		// -----------------------------
		// Searchable Buyer Input (Name + ID in one line)
		// -----------------------------
		let buyerInput = container.find("#buyer-input");
		let suggestionBox = container.find("#buyer-suggestions");

		// Prefill Buyer Name if existing
		if (this.prefilled_buyer_name) {
			buyerInput.val(this.prefilled_buyer_name).data("buyer-id", this.prefilled_buyer);
		}

		// Prefill Sale Date if existing
		if (this.prefilled_sale_date) {
			container.find("#sale-date").val(this.prefilled_sale_date);
		}

		function renderSuggestions(filteredList) {
			suggestionBox.empty();
			if (!filteredList.length) {
				suggestionBox.append(`<div class="no-results">No buyers found</div>`);
				return;
			}
			filteredList.slice(0, 10).forEach((b) => {
				let displayText = `${b.customer_name}${b.id_number ? " - " + b.id_number : ""}`;
				suggestionBox.append(
					`<div class="suggestion-item" data-id="${b.name}" data-name="${b.customer_name}">
						${displayText}
					</div>`
				);
			});
		}

		buyerInput.on("focus", function () {
			renderSuggestions(buyers);
		});

		buyerInput.on("input", function () {
			let query = $(this).val().toLowerCase();
			let filtered = buyers.filter((b) => b.customer_name.toLowerCase().includes(query));
			renderSuggestions(filtered);
		});

		buyerInput.on("keydown", function (e) {
			if (e.key === "Enter") {
				let query = $(this).val().toLowerCase();
				let filtered = buyers.filter((b) => b.customer_name.toLowerCase().includes(query));
				if (filtered.length === 1) {
					let selected = filtered[0];
					buyerInput.val(selected.customer_name).data("buyer-id", selected.name);
					suggestionBox.empty();
					e.preventDefault();
				}
			}
		});

		suggestionBox.on("click", ".suggestion-item", function () {
			let selectedName = $(this).data("name");
			let selectedId = $(this).data("id");
			buyerInput.val(selectedName).data("buyer-id", selectedId);
			suggestionBox.empty();
		});

		$(document).on("click", function (e) {
			if (!$(e.target).closest("#buyer-input, #buyer-suggestions").length) {
				suggestionBox.empty();
			}
		});

		const loader = container.find(".loader-overlay");
		const content = container.find(".buyer-content");

		loader.fadeOut(200, () => {
			content.fadeIn(200);
		});

		// -----------------------------
		// Button actions
		// -----------------------------
		container.find(".back-btn").on("click", () => this.backCallback());

		container.find(".continue-btn").on("click", async () => {
			const self = this; // IMPORTANT: fix “this undefined” issue

			let buyer = buyerInput.data("buyer-id");
			let buyer_name = buyerInput.val();

			if (!buyer || buyer === "-- Select Buyer --") {
				frappe.msgprint("Please select a buyer.");
				return;
			}

			let sale_date = container.find("#sale-date").val();

			// -------------------------------
			// STEP 1: Check if Txn already exists
			// -------------------------------
			const existingRes = await frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Wholesale Transaction",
					filters: {
						wholesale_bag: self.selected_bag_data.warehouse_name,
						buyer: buyer,
					},
					fields: ["name"],
					limit: 1,
				},
			});

			const alreadyLinked =
				existingRes.message && existingRes.message.length > 0 ? true : false;

			// ---------------------------------------------------------
			// If already linked → Skip confirmation & go to next step
			// ---------------------------------------------------------
			if (alreadyLinked) {
				console.log("Skipping confirmation: Buyer already linked previously.");
				proceedToNextStep();
				return;
			}

			// ---------------------------------------------------------
			// If NOT linked → Show confirmation popup (only first time)
			// ---------------------------------------------------------
			frappe.confirm(
				`Are you sure you want to <b>link Buyer "${buyer_name}"</b><br>with Bag <b>${self.selected_bag_data.warehouse_name}</b>?`,

				async () => {
					// User confirmed → Create record then proceed
					await createTransactionIfNeeded();
					proceedToNextStep();
				}
			);

			// ---------------------------------------------------------
			// Helper: Create Wholesale Transaction record
			// ---------------------------------------------------------
			async function createTransactionIfNeeded() {
				const baseTransaction = {
					doctype: "Wholesale Transaction",
					wholesale_bag: self.selected_bag_data.warehouse_name,
					buyer: buyer,
					buyer_name: buyer_name,
					sale_date: sale_date,
					status: "Active",
				};

				const insertRes = await frappe.call({
					method: "frappe.client.insert",
					args: { doc: baseTransaction },
				});

				if (insertRes.message && insertRes.message.name) {
					frappe.msgprint({
						message: "New Wholesale Transaction created successfully.",
						indicator: "green",
					});
				}
			}

			// ---------------------------------------------------------
			// Helper: Move to next step
			// ---------------------------------------------------------
			async function proceedToNextStep() {
				const normalizedBagSummary = (self.prefilled_bag_summary || bagSummary).map(
					(r) => ({
						purity: r.purity,
						weight: parseFloat(r.total_qty) || 0,
						rate: parseFloat(r.avg_rate) || 0,
						amount: parseFloat(r.total_amount_rm) || 0,
					})
				);

				const totalCost = normalizedBagSummary.reduce((sum, r) => sum + r.amount, 0);

				// ---------------------------------------------
				// 1️⃣ FETCH the Wholesale Transaction doc
				// ---------------------------------------------
				const txnRes = await frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Wholesale Transaction",
						filters: {
							wholesale_bag: self.selected_bag_data.warehouse_name,
							buyer: buyer,
						},
						fields: ["name"],
						limit: 1,
					},
				});

				if (!txnRes.message || txnRes.message.length === 0) {
					console.error("Transaction not found during Step 2 → proceedToNextStep()");
					frappe.msgprint("System error: Missing Wholesale Transaction.");
					return;
				}

				const txnName = txnRes.message[0].name;

				// ---------------------------------------------
				// 2️⃣ BUILD reconciliation_lines from bag data
				// ---------------------------------------------
				const reconciliationLines = normalizedBagSummary.map((line) => ({
					purity: line.purity,
					actual: line.weight,
					claimed: line.weight, // initial = actual
					delta: 0, // no differences on step 2
					status: "Pending",
					avg_rate: line.rate,
					cost_basis: line.amount,
					revenue: 0,
					profit: 0,
					profit_g: 0,
					margin_percent: 0,
				}));

				// ---------------------------------------------
				// 3️⃣ UPDATE the Wholesale Transaction
				// ---------------------------------------------
				const txnDoc = await frappe.call({
					method: "frappe.client.get",
					args: { doctype: "Wholesale Transaction", name: txnName },
				});

				if (txnDoc.message) {
					txnDoc.message.reconciliation_lines = reconciliationLines;
					txnDoc.message.total_cost_basis = totalCost;

					await frappe.call({
						method: "frappe.client.save",
						args: { doc: txnDoc.message },
					});

					console.log("✔ Step 2 → Reconciliation Lines Saved Successfully");
				}

				// ---------------------------------------------
				// 4️⃣ Continue to Step 3 UI
				// ---------------------------------------------
				self.nextStepCallback({
					selected_bag: self.selected_bag_data.warehouse_name,
					buyer: buyer,
					buyer_name: buyer_name,
					sale_date: sale_date,
					bagSummary: normalizedBagSummary,
					totalAmount: totalCost,
					reconSummary: reconciliationLines, // pass fresh table to Step-3
					adjustments: [],
				});
			}
		});

		// -----------------------------------------
		// Add Buyer Button → Supplier Quick Entry Form
		// -----------------------------------------
		container.find("#add-buyer-btn").on("click", () => {
			const dialog = new frappe.ui.Dialog({
				title: "Add New Buyer",
				fields: [
					{
						label: "Buyer Name",
						fieldname: "customer_name",
						fieldtype: "Data",
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

					// Malaysian Only
					{ label: "Malaysian ID", fieldname: "malaysian_id", fieldtype: "Data" },

					// Non–Malaysian
					{
						label: "Nationality",
						fieldname: "other_id_type",
						fieldtype: "Data",
					},

					{ label: "Nationality ID", fieldname: "other_id_number", fieldtype: "Data" },

					{
						label: "Mobile Number",
						fieldname: "mobile_number",
						fieldtype: "Data",
						reqd: 1, // default required
					},

					{
						label: "Mobile Number NA",
						fieldname: "mobile_number_na",
						fieldtype: "Check",
						default: 0,
					},
				],

				primary_action_label: "Save Buyer",
				primary_action: async (values) => {
					// ----------------------------------------------------
					// VALIDATION LOGIC
					// ----------------------------------------------------

					// Malaysian Logic
					if (values.customer_nationality === "Malaysian") {
						let digits = (values.malaysian_id || "").replace(/\D/g, "");
						if (digits.length !== 12) {
							frappe.msgprint("Malaysian ID must be exactly 12 digits.");
							return;
						}

						// Auto-format
						values.malaysian_id = `${digits.slice(0, 6)}-${digits.slice(
							6,
							8
						)}-${digits.slice(8)}`;
					}

					// Others logic → "Nationality ID" required
					if (values.customer_nationality === "Others") {
						if (!values.other_id_number) {
							frappe.msgprint("Nationality ID is required.");
							return;
						}
					}

					// Mobile validation
					if (!values.mobile_number_na) {
						let digits = (values.mobile_number || "").replace(/\D/g, "");
						if (digits.length !== 10 && digits.length !== 11) {
							frappe.msgprint("Mobile number must be 10 or 11 digits.");
							return;
						}

						values.mobile_number =
							digits.length === 10
								? `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6)}`
								: `${digits.slice(0, 3)}-${digits.slice(3, 7)} ${digits.slice(7)}`;
					}

					dialog.hide();

					// ----------------------------------------------------
					// BACKEND INSERT
					// ----------------------------------------------------
					try {
						const res = await frappe.call({
							method: "frappe.client.insert",
							args: {
								doc: {
									doctype: "Supplier",
									supplier_name: values.customer_name,
									supplier_group: "Wholesale",

									customer_nationality: values.customer_nationality,

									malaysian_id:
										values.customer_nationality === "Malaysian"
											? values.malaysian_id
											: "",

									other_id_type:
										values.customer_nationality === "Others"
											? values.other_id_type
											: "",

									other_id_number:
										values.customer_nationality === "Others"
											? values.other_id_number
											: "",

									mobile_number: values.mobile_number || "",
									mobile_number_na: values.mobile_number_na,
								},
							},
						});

						if (res.message) {
							const newBuyer = res.message;

							// Add to buyers list
							buyers.push({
								name: newBuyer.name,
								customer_name: newBuyer.supplier_name,
								id_number: newBuyer.malaysian_id || newBuyer.other_id_number || "",
								customer_group: "Wholesale",
							});

							// Auto-select buyer
							buyerInput.val(newBuyer.supplier_name).data("buyer-id", newBuyer.name);

							frappe.show_alert({ message: "Buyer added successfully." });
						}
					} catch (err) {
						console.error(err);
						frappe.msgprint("Failed to save buyer.");
					}
				},
			});

			// ------------------------------------------------------
			// FORCE Mobile Number Required ON LOAD
			// ------------------------------------------------------
			dialog.set_df_property("mobile_number", "reqd", 1);

			// ------------------------------------------------------
			// MALAYSIAN vs OTHER NATIONALITY TOGGLE
			// ------------------------------------------------------
			function toggleNationality() {
				const nationality = dialog.get_value("customer_nationality");

				if (nationality === "Malaysian") {
					// Malaysian — Malaysian ID required
					dialog.set_df_property("malaysian_id", "reqd", 1);
					dialog.get_field("malaysian_id").$wrapper.show();

					// Hide Other fields + remove required
					dialog.set_df_property("other_id_type", "reqd", 0);
					dialog.set_df_property("other_id_number", "reqd", 0);

					dialog.get_field("other_id_type").$wrapper.hide();
					dialog.get_field("other_id_number").$wrapper.hide();
				} else {
					// Others — Malaysian ID not required
					dialog.set_df_property("malaysian_id", "reqd", 0);
					dialog.get_field("malaysian_id").$wrapper.hide();

					// SHOW other ID type + ID number & MAKE BOTH REQUIRED
					dialog.get_field("other_id_type").$wrapper.show();
					dialog.get_field("other_id_number").$wrapper.show();

					dialog.set_df_property("other_id_type", "reqd", 1);
					dialog.set_df_property("other_id_number", "reqd", 1);
				}
			}

			dialog.fields_dict.customer_nationality.$input.on("change", toggleNationality);
			setTimeout(() => toggleNationality(), 200);

			// ------------------------------------------------------
			// MALAYSIAN ID AUTO-FORMAT
			// ------------------------------------------------------
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

			// ------------------------------------------------------
			// MOBILE NUMBER NA TOGGLE
			// ------------------------------------------------------
			const mobile_na_field = dialog.get_field("mobile_number_na");

			if (mobile_na_field && mobile_na_field.$input) {
				mobile_na_field.$input.on("change", () => {
					const is_na = dialog.get_value("mobile_number_na");
					const mobile_f = dialog.get_field("mobile_number");

					dialog.set_df_property("mobile_number", "reqd", is_na ? 0 : 1);

					if (is_na) {
						dialog.set_value("mobile_number", "");
					}

					mobile_f.refresh();
				});
			}

			// ------------------------------------------------------
			// MOBILE NUMBER AUTO-FORMAT
			// ------------------------------------------------------
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
	}
}
