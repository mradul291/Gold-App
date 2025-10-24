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
				<div class="buyer-form-block">
					<div class="form-group">
						<label for="buyer-select">Select Buyer <span class="req">*</span></label>
						<select id="buyer-select" class="input-select">
							<option>-- Select Buyer --</option>
						</select>
					</div>
					<div class="form-group mt-2">
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
		console.log("Selected Bag:", this.selected_bag);
		console.log("Warehouse stock response:", res);

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
		// Fetch buyers dynamically
		// -----------------------------
		let buyers = await frappe.db.get_list("Customer", {
			fields: ["name", "customer_name"],
		});
		let buyerSelect = container.find("#buyer-select");

		let buyerMap = {};
		buyers.forEach((b) => {
			buyerSelect.append(`<option value="${b.name}">${b.customer_name}</option>`);
			buyerMap[b.name] = b.customer_name;
		});

		// -----------------------------
		// Button actions
		// -----------------------------
		container.find(".back-btn").on("click", () => this.backCallback());

		container.find(".continue-btn").on("click", () => {
			let buyer = container.find("#buyer-select").val();
			let buyer_name = buyerMap[buyer];
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
