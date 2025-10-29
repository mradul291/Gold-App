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
				<div class="bag-details-summary"></div>
				<div class="buyer-form-block flex-row">
<div class="form-group" style="flex: 1; min-width: 200px;">
    <label for="buyer-input">Select Buyer <span class="req">*</span></label>
    <input type="text" id="buyer-input" class="input-text" placeholder="Search Buyer...">
    <div id="buyer-suggestions" class="dropdown-suggestions"></div>
</div>

    <div class="form-group" style="flex: 1; min-width: 200px; margin-left: 16px;">
        <label for="sale-date">Sale Date</label>
        <input type="date" class="input-date" id="sale-date"
            value="${frappe.datetime.nowdate()}"/>
    </div>
</div>

				<div class="button-row">
					<button class="btn-secondary back-btn">&lt; Back</button>
					<button class="btn-primary continue-btn">Continue &rarr;</button>
				</div>
			</div>
		`);
		this.container.empty().append(container);

		// -----------------------------
		// Fetch bag summary dynamically
		// -----------------------------
		let res = await frappe.call({
			method: "gold_app.api.sales.wholesale_warehouse.get_warehouse_stock",
			args: { warehouse_name: this.selected_bag_data.warehouse_id },
		});

		let bagSummary = (res && res.message) || [];
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
			filters: {
				customer_group: "Wholesale",
			},
		});

		// -----------------------------
		// Searchable Buyer Input (Name + ID in one line)
		// -----------------------------
		let buyerInput = container.find("#buyer-input");
		let suggestionBox = container.find("#buyer-suggestions");

		// Function to render suggestion list
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

		// Show all buyers when focused
		buyerInput.on("focus", function () {
			renderSuggestions(buyers);
		});

		// Show filtered buyers as user types
		buyerInput.on("input", function () {
			let query = $(this).val().toLowerCase();
			let filtered = buyers.filter((b) => b.customer_name.toLowerCase().includes(query));

			// Auto-select if only one result matches
			if (filtered.length === 1) {
				let selected = filtered[0];
				buyerInput.val(selected.customer_name).data("buyer-id", selected.name);
				suggestionBox.empty();
				return;
			}

			renderSuggestions(filtered);
		});

		// Handle selection from dropdown
		suggestionBox.on("click", ".suggestion-item", function () {
			let selectedName = $(this).data("name");
			let selectedId = $(this).data("id");
			buyerInput.val(selectedName).data("buyer-id", selectedId);
			suggestionBox.empty();
		});

		// Hide suggestion list when clicking outside
		$(document).on("click", function (e) {
			if (!$(e.target).closest("#buyer-input, #buyer-suggestions").length) {
				suggestionBox.empty();
			}
		});

		// -----------------------------
		// Button actions
		// -----------------------------
		container.find(".back-btn").on("click", () => this.backCallback());

		container.find(".continue-btn").on("click", () => {
			let buyer = buyerInput.data("buyer-id");
			let buyer_name = buyerInput.val();
			if (!buyer || buyer === "-- Select Buyer --") {
				frappe.msgprint("Please select a buyer.");
				return;
			}

			let sale_date = container.find("#sale-date").val();

			// Normalize bagSummary to match Step 3
			const normalizedBagSummary = bagSummary.map((r) => ({
				purity: r.purity,
				weight: parseFloat(r.total_qty) || 0,
				rate: parseFloat(r.avg_rate) || 0,
				amount: parseFloat(r.total_amount_rm) || 0,
			}));

			const totalCost = normalizedBagSummary.reduce((sum, r) => sum + r.amount, 0);

			// Pass normalized data to Step 3
			this.nextStepCallback({
				selected_bag: this.selected_bag_data.warehouse_name, // Step 3 expects this
				buyer: buyer,
				buyer_name: buyer_name,
				sale_date: sale_date,
				bagSummary: normalizedBagSummary,
				totalAmount: totalCost,
				reconSummary: [], // optional, Step 3 will initialize
				adjustments: [], // optional
			});
		});
	}
}

// Version - 2

// class Step2BuyerDetails {
// 	constructor(container, selected_bag_data, nextStepCallback, backCallback) {
// 		this.container = container;
// 		this.selected_bag_data = selected_bag_data;
// 		this.nextStepCallback = nextStepCallback;
// 		this.backCallback = backCallback;

// 		// Initialize defaults for data fields
// 		this.buyer = null;
// 		this.buyer_name = "";
// 		this.sale_date = frappe.datetime.nowdate();
// 		this.bagSummary = [];

// 		// Call async initialization
// 		this.init();
// 	}

// 	async init() {
// 		try {
// 			const res = await frappe.call({
// 				method: "gold_app.api.sales.wholesale_warehouse.get_wholesale_transaction_by_bag",
// 				args: { wholesale_bag: this.selected_bag_data.warehouse_name },
// 			});

// 			if (res.message && res.message.status === "success") {
// 				const data = res.message.data;
// 				// Load saved data from backend
// 				this.buyer = data.buyer || this.buyer;
// 				this.buyer_name = data.buyer_name || this.buyer_name;
// 				this.sale_date = data.sale_date || this.sale_date;
// 				this.bagSummary = data.receipt_lines || [];
// 			} else {
// 				// No saved transaction - fallback to warehouse stock
// 				await this.loadWarehouseStock();
// 			}
// 		} catch (e) {
// 			console.warn("Failed to load saved transaction data, falling back", e);
// 			await this.loadWarehouseStock();
// 		}

// 		// Render UI with loaded or fallback data
// 		this.render();
// 		this.attachHandlers();
// 	}

// 	async loadWarehouseStock() {
// 		let res = await frappe.call({
// 			method: "gold_app.api.sales.wholesale_warehouse.get_warehouse_stock",
// 			args: { warehouse_name: this.selected_bag_data.warehouse_id },
// 		});

// 		this.bagSummary = (res && res.message) || [];
// 	}

// 	async render() {
// 		const container = $(`
//             <div class="buyer-details-container">
//                 <div class="bag-details-summary"></div>
//                 <div class="buyer-form-block flex-row">
//                     <div class="form-group" style="flex: 1; min-width: 200px;">
//                         <label for="buyer-input">Select Buyer <span class="req">*</span></label>
//                         <input type="text" id="buyer-input" class="input-text" placeholder="Search Buyer..." value="${this.escapeHtml(
// 							this.buyer_name
// 						)}">
//                         <div id="buyer-suggestions" class="dropdown-suggestions"></div>
//                     </div>

//                     <div class="form-group" style="flex: 1; min-width: 200px; margin-left: 16px;">
//                         <label for="sale-date">Sale Date</label>
//                         <input type="date" class="input-date" id="sale-date"
//                             value="${frappe.datetime.str_to_user(this.sale_date)}"/>
//                     </div>
//                 </div>

//                 <div class="button-row">
//                     <button class="btn-secondary back-btn">&lt; Back</button>
//                     <button class="btn-primary continue-btn">Continue &rarr;</button>
//                 </div>
//             </div>
//         `);
// 		this.container.empty().append(container);

// 		// Render bag summary table from loaded bagSummary (saved or warehouse)
// 		let totalAmount = this.bagSummary.reduce(
// 			(s, r) => s + parseFloat(r.total_amount_rm || r.amount || 0),
// 			0
// 		);
// 		let summaryHTML = `
//             <div class="bag-summary-block">
//                 <div class="bag-title-row">
//                     <span class="bag-label">Selected Bag: <b>${this.escapeHtml(
// 						this.selected_bag_data.warehouse_name
// 					)}</b></span>
//                 </div>
//                 <table class="summary-table">
//                     <thead>
//                         <tr>
//                             <th>Purity</th>
//                             <th>Weight (g)</th>
//                             <th>AVCO (RM/g)</th>
//                             <th>Total Amount (RM)</th>
//                         </tr>
//                     </thead>
//                     <tbody>
//                         ${this.bagSummary
// 							.map(
// 								(r) => `
//                             <tr>
//                                 <td>${this.escapeHtml(r.purity)}</td>
//                                 <td>${parseFloat(r.total_qty || r.weight || 0).toFixed(2)} g</td>
//                                 <td>RM ${parseFloat(r.avg_rate || r.rate || 0).toFixed(2)}</td>
//                                 <td>RM ${parseFloat(
// 									r.total_amount_rm || r.amount || 0
// 								).toLocaleString("en-MY", {
// 									minimumFractionDigits: 2,
// 								})}</td>
//                             </tr>`
// 							)
// 							.join("")}
//                         <tr class="summary-total-row">
//                             <td><b>TOTAL</b></td>
//                             <td><b>${this.bagSummary
// 								.reduce((t, r) => t + parseFloat(r.total_qty || r.weight || 0), 0)
// 								.toFixed(2)} g</b></td>
//                             <td>-</td>
//                             <td><b>RM ${totalAmount.toLocaleString("en-MY", {
// 								minimumFractionDigits: 2,
// 							})}</b></td>
//                         </tr>
//                     </tbody>
//                 </table>
//             </div>`;
// 		container.find(".bag-details-summary").html(summaryHTML);

// 		// -----------------------------
// 		// Fetch buyers dynamically (only Wholesale customers)
// 		// -----------------------------
// 		this.buyers = await frappe.db.get_list("Customer", {
// 			fields: ["name", "customer_name", "id_number", "customer_group"],
// 			filters: { customer_group: "Wholesale" },
// 		});

// 		this.setupBuyerInputListeners();
// 	}

// 	setupBuyerInputListeners() {
// 		const container = this.container;
// 		const buyerInput = container.find("#buyer-input");
// 		const suggestionBox = container.find("#buyer-suggestions");
// 		const buyers = this.buyers;

// 		// Function to render suggestion list
// 		function renderSuggestions(filteredList) {
// 			suggestionBox.empty();
// 			if (!filteredList.length) {
// 				suggestionBox.append(`<div class="no-results">No buyers found</div>`);
// 				return;
// 			}
// 			filteredList.slice(0, 10).forEach((b) => {
// 				let displayText = `${b.customer_name}${b.id_number ? " - " + b.id_number : ""}`;
// 				suggestionBox.append(
// 					`<div class="suggestion-item" data-id="${b.name}" data-name="${b.customer_name}">
//                         ${displayText}
//                     </div>`
// 				);
// 			});
// 		}

// 		// Show all buyers when focused
// 		buyerInput.on("focus", function () {
// 			renderSuggestions(buyers);
// 		});

// 		// Show filtered buyers on input
// 		buyerInput.on("input", function () {
// 			let query = $(this).val().toLowerCase();
// 			let filtered = buyers.filter((b) => b.customer_name.toLowerCase().includes(query));

// 			if (filtered.length === 1) {
// 				let selected = filtered[0];
// 				buyerInput.val(selected.customer_name).data("buyer-id", selected.name);
// 				suggestionBox.empty();
// 				return;
// 			}
// 			renderSuggestions(filtered);
// 		});

// 		// Handle selection
// 		suggestionBox.on("click", ".suggestion-item", function () {
// 			let selectedName = $(this).data("name");
// 			let selectedId = $(this).data("id");
// 			buyerInput.val(selectedName).data("buyer-id", selectedId);
// 			suggestionBox.empty();
// 		});

// 		// Hide suggestions on outside click
// 		$(document).on("click", function (e) {
// 			if (!$(e.target).closest("#buyer-input, #buyer-suggestions").length) {
// 				suggestionBox.empty();
// 			}
// 		});

// 		// Button actions
// 		container
// 			.find(".back-btn")
// 			.off("click")
// 			.on("click", () => this.backCallback());

// 		container
// 			.find(".continue-btn")
// 			.off("click")
// 			.on("click", () => {
// 				let buyer = buyerInput.data("buyer-id") || this.buyer;
// 				let buyer_name = buyerInput.val() || this.buyer_name;
// 				if (!buyer) {
// 					frappe.msgprint("Please select a buyer.");
// 					return;
// 				}

// 				let sale_date = container.find("#sale-date").val() || this.sale_date;

// 				// Normalize bagSummary to match Step 3 expectations
// 				const normalizedBagSummary = this.bagSummary.map((r) => ({
// 					purity: r.purity,
// 					weight: parseFloat(r.total_qty || r.weight || 0),
// 					rate: parseFloat(r.avg_rate || r.rate || 0),
// 					amount: parseFloat(r.total_amount_rm || r.amount || 0),
// 				}));

// 				const totalCost = normalizedBagSummary.reduce((sum, r) => sum + r.amount, 0);

// 				this.nextStepCallback({
// 					selected_bag: this.selected_bag_data.warehouse_name,
// 					buyer: buyer,
// 					buyer_name: buyer_name,
// 					sale_date: sale_date,
// 					bagSummary: normalizedBagSummary,
// 					totalAmount: totalCost,
// 					reconSummary: [],
// 					adjustments: [],
// 				});
// 			});
// 	}

// 	// Utility
// 	escapeHtml(text) {
// 		if (!text) return "";
// 		return text.replace(/[&<>"'`=\/]/g, function (s) {
// 			return (
// 				{
// 					"&": "&amp;",
// 					"<": "&lt;",
// 					">": "&gt;",
// 					'"': "&quot;",
// 					"'": "&#39;",
// 					"/": "&#x2F;",
// 					"`": "&#x60;",
// 					"=": "&#x3D;",
// 				}[s] || s
// 			);
// 		});
// 	}
// }
