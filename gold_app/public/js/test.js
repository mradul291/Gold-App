class Step3ReceiptAndReconciliation {
	constructor(
		container,
		{
			selected_bag,
			buyer,
			sale_date,
			bagSummary,
			totalAmount,
			reconSummary = [],
			adjustments = [],
		},
		backCallback
	) {
		this.container = container;
		this.selected_bag = selected_bag;
		this.buyer = buyer;
		this.sale_date = sale_date;
		this.bagSummary = bagSummary;
		this.totalAmount = totalAmount;
		this.reconSummary = reconSummary.length ? reconSummary : this.initializeReconSummary();
		this.adjustments = adjustments;
		this.backCallback = backCallback;
		this.activeTab = "Sale Details";
		this.render();
	}

	// Initialize reconSummary based on bagSummary
	initializeReconSummary() {
		return this.bagSummary.map((r) => ({
			purity: r.purity,
			actual: 0,
			claimed: r.weight,
			cost_basis: r.amount,
			revenue: 0,
			profit: -r.amount,
			profit_g: 0,
			margin_percent: 0,
		}));
	}

	render() {
		let tabs = ["Sale Details", "Receipt & Reconciliation", "Payment Entry"];
		let html = `
        <div class="receipt-recon-container">
            <div class="tab-row">
                ${tabs
					.map(
						(tab) => `
                    <div class="tab ${
						this.activeTab === tab ? "tab-active" : ""
					}" data-tab="${tab}">${tab}</div>
                `
					)
					.join("")}
            </div>
            <div class="tab-content">
                ${this.activeTab === "Sale Details" ? this.renderSaleDetails() : ""}
                ${
					this.activeTab === "Receipt & Reconciliation"
						? this.renderReceiptReconciliation()
						: ""
				}
                ${this.activeTab === "Payment Entry" ? this.renderPaymentEntry() : ""}
            </div>
        </div>
        `;
		this.container.html(html);

		// Tab switching
		this.container.find(".tab").on("click", (e) => {
			let tab = $(e.target).data("tab");
			if (tab === this.activeTab) return;
			this.activeTab = tab;
			this.render();
		});

		// Sale Details Continue button
		if (this.activeTab === "Sale Details") {
			this.container.find(".continue-btn").on("click", () => {
				this.activeTab = "Receipt & Reconciliation";
				this.render();
			});
		}

		// Receipt & Reconciliation buttons
		if (this.activeTab === "Receipt & Reconciliation") {
			this.bindReceiptEvents();
			this.container.find(".back-to-sale-btn").on("click", () => {
				this.activeTab = "Sale Details";
				this.render();
			});
			this.container.find(".save-continue-btn").on("click", () => {
				this.activeTab = "Payment Entry";
				this.render();
			});
		}
	}

	// Sale Summary UI
	renderSaleDetails() {
		return `
		<div class="summary-section">
			<h4 class="section-title">Sale Summary</h4>
			<div class="summary-row">
				<div class="summary-block">
					<div class="summary-label">Wholesale Bag</div>
					<div class="summary-value">${this.selected_bag}</div>
				</div>
				<div class="summary-block">
					<div class="summary-label">Buyer</div>
					<div class="summary-value">${this.buyer}</div>
				</div>
			</div>
			<div class="summary-row">
				<div class="summary-block">
					<div class="summary-label">Sale Date</div>
					<div class="summary-value">${this.sale_date}</div>
				</div>
				<div class="summary-block summary-block-highlight">
					<div class="summary-label">Total Cost Basis</div>
					<div class="summary-value summary-value-highlight">
						RM ${this.totalAmount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}
					</div>
				</div>
			</div>
		</div>
		<hr>
		<div class="bag-content-section">
			<h4 class="section-title">Bag Contents</h4>
			<table class="summary-table">
				<thead>
					<tr>
						<th>Purity</th>
						<th>Weight (g)</th>
						<th>AVCO (RM/g)</th>
						<th>Total Cost (RM)</th>
					</tr>
				</thead>
				<tbody>
					${this.bagSummary
						.map(
							(r) => `
						<tr>
							<td>${r.purity}</td>
							<td>${(r.weight || 0).toFixed(2)} g</td>
							<td>${(r.rate || 0).toFixed(2)}</td>
							<td>RM ${(r.amount || 0).toLocaleString("en-MY", { minimumFractionDigits: 2 })}</td>
						</tr>
					`
						)
						.join("")}
					<tr class="summary-total-row">
						<td><b>TOTAL</b></td>
						<td><b>${this.bagSummary.reduce((t, r) => t + r.weight, 0).toFixed(2)} g</b></td>
						<td>-</td>
						<td><b>RM ${this.totalAmount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</b></td>
					</tr>
				</tbody>
			</table>
		</div>
		<hr>
		<div class="action-row">
			<button class="btn-primary continue-btn">Continue to Receipt Input →</button>
		</div>
		`;
	}

	// Receipt & Reconciliation UI
	renderReceiptReconciliation() {
		const receiptLines = this.bagSummary
			.map(
				(r, idx) => `
        <tr data-idx="${idx}">
            <td><span class="move-arrows"><span class="up-arrow">&#9650;</span><span class="down-arrow">&#9660;</span></span></td>
            <td><input type="text" class="input-purity" value="${r.purity}" readonly></td>
            <td><input type="number" class="input-weight" value="0.00" data-purity="${r.purity}"></td>
            <td><input type="number" class="input-rate" value="0.00" data-purity="${r.purity}"></td>
            <td><input type="number" class="input-amount" value="0.00" data-purity="${r.purity}"></td>
            <td><button class="delete-row-btn" data-idx="${idx}">&#128465;</button></td>
        </tr>`
			)
			.join("");

		const reconRows = this.reconSummary
			.map(
				(r, idx) => `
        <tr data-idx="${idx}" data-purity="${r.purity}">
            <td>${r.purity}</td>
            <td class="actual-cell">${r.actual.toFixed(2)}</td>
            <td class="claimed-cell">${(r.claimed || 0).toFixed(2)}</td>
            <td class="delta-cell">${(r.actual - r.claimed).toFixed(2)}</td>
            <td class="status-cell"><span class="status-icon info">&#9432;</span></td>
            <td class="cost-basis">RM ${(r.cost_basis || 0).toLocaleString("en-MY", {
				minimumFractionDigits: 2,
			})}</td>
            <td class="revenue-cell">RM ${(r.revenue || 0).toLocaleString("en-MY", {
				minimumFractionDigits: 2,
			})}</td>
            <td class="profit-cell">RM ${r.profit.toLocaleString("en-MY", {
				minimumFractionDigits: 2,
			})}</td>
            <td class="profit-g-cell">RM ${(r.profit_g || 0).toLocaleString("en-MY", {
				minimumFractionDigits: 2,
			})}</td>
            <td class="margin-cell">${(r.margin_percent || 0).toFixed(1)}%</td>
        </tr>`
			)
			.join("");

		const adjustmentRows = this.adjustments
			.map(
				(r, idx) => `
        <tr data-idx="${idx}">
            <td>${idx + 1}</td>
            <td>${r.type}</td>
            <td>${r.from_purity}</td>
            <td>${r.to_purity}</td>
            <td>${r.weight}</td>
            <td>${r.notes}</td>
            <td>${r.impact}</td>
        </tr>`
			)
			.join("");

		setTimeout(() => {
			const updateReconciliation = () => {
				const rows = document.querySelectorAll(".receipt-table tbody tr[data-idx]");
				rows.forEach((row) => {
					const purity = row.querySelector(".input-purity").value.trim();
					const weight = parseFloat(row.querySelector(".input-weight").value) || 0;
					const rate = parseFloat(row.querySelector(".input-rate").value) || 0;
					const amount =
						parseFloat(row.querySelector(".input-amount").value) || weight * rate;

					// Find the matching Reconciliation row
					const reconRow = document.querySelector(
						`.recon-table tr[data-purity="${purity}"]`
					);
					if (reconRow) {
						// Fetch base/sale reference data (should be set dynamically in real implementation)
						// Here, simulate as:
						const baseClaimed =
							parseFloat(reconRow.querySelector(".claimed-cell").textContent) || 0;
						const baseCostBasis =
							parseFloat(
								reconRow
									.querySelector(".cost-basis")
									.textContent.replace(/[^\d.-]/g, "")
							) || 0;

						// Compute values
						const claimed = baseClaimed;
						const actual = weight;
						const delta = (actual - claimed).toFixed(2);

						// Standard matching case (all equal to sale)
						let revenue = 0,
							profit = 0,
							profitG = 0,
							margin = 0;
						let statusHTML = "";

						// Condition: data perfect (matching weights, and no mismatch)
						if (
							Math.abs(actual - claimed) < 0.001 &&
							Math.abs(amount - baseCostBasis) < 0.001
						) {
							// Perfect: Check icon and green highlight
							statusHTML = '<span class="status-icon success">&#10004;</span>';
							// Add green text color class for full row
							reconRow.classList.add("recon-row-green");
						} else {
							// When mismatch — calculate reconciliation impact
							revenue = amount;
							profit = revenue - baseCostBasis;
							profitG = actual ? profit / actual : 0;
							margin = revenue ? (profit / revenue) * 100 : 0;

							if (profit > 0) {
								// Profit case → also green with check mark
								statusHTML = '<span class="status-icon success">&#10004;</span>';
								reconRow.classList.add("recon-row-green");
							} else {
								// Loss or mismatch → warning icon and default text color
								statusHTML = '<span class="status-icon warning">&#9888;</span>';
								reconRow.classList.remove("recon-row-green");
							}
						}

						// update reconciliation cells
						reconRow.querySelector(".actual-cell").textContent = actual.toFixed(2);
						reconRow.querySelector(".delta-cell").textContent = delta;
						reconRow.querySelector(
							".revenue-cell"
						).textContent = `RM ${revenue.toLocaleString("en-MY", {
							minimumFractionDigits: 2,
						})}`;
						reconRow.querySelector(
							".profit-cell"
						).textContent = `RM ${profit.toLocaleString("en-MY", {
							minimumFractionDigits: 2,
						})}`;
						reconRow.querySelector(
							".profit-g-cell"
						).textContent = `RM ${profitG.toLocaleString("en-MY", {
							minimumFractionDigits: 2,
						})}`;
						reconRow.querySelector(".margin-cell").textContent = `${margin.toFixed(
							1
						)}%`;
						reconRow.querySelector(".status-cell").innerHTML = statusHTML;
					}
				});
			};
			setTimeout(() => this.renderAdjustmentsSection(), 100);

			document
				.querySelectorAll(".input-weight, .input-rate, .input-amount")
				.forEach((input) => input.addEventListener("input", updateReconciliation));
		}, 100);

		return `
        <div class="section1-buyer-receipt">
            <h4 class="section-title">Section 1: Buyer's Official Receipt</h4>
            <p class="input-caption">Enter what the buyer actually paid for</p>
            <table class="receipt-table">
                <thead><tr><th>Move</th><th>Purity</th><th>Weight (g) *</th><th>Rate (RM/g)</th><th>Amount (RM)</th><th>Action</th></tr></thead>
                <tbody>${receiptLines}
                    <tr><td colspan="2" class="footer-total">TOTAL</td><td>0.00 g</td><td>-</td><td>RM 0.00</td><td></td></tr>
                </tbody>
            </table>
            <button class="add-receipt-line-btn btn-receipt">+ Add Receipt Line</button>
            <button class="btn-upload-receipt">Upload Receipt</button>
        </div>
        <hr>
        <div class="section2-recon-summary">
            <h4 class="section-title">Section 2: Reconciliation Summary</h4>
            <p class="input-caption">Live updates as adjustments are added</p>
            <table class="recon-table">
                <thead><tr><th>Purity</th><th>Actual (g)</th><th>Claimed (g)</th><th>Δ (g)</th><th>Status</th><th>Cost Basis</th><th>Revenue</th><th>Profit</th><th>Profit/g</th><th>Margin %</th></tr></thead>
                <tbody>${reconRows}</tbody>
            </table>
        </div>
        <hr>
        <div class="section3-adjustments">
    <h4 class="section-title">Section 3: Adjustments</h4>
    <p class="input-caption">Add adjustment rows until Claimed = Actual</p>
    <table class="adjust-table">
        <thead><tr><th>#</th><th>Adjustment Type</th><th>From Purity</th><th>To Purity</th><th>Weight (g)</th><th>Notes / Remarks</th><th>Profit Impact</th><th>Delete</th></tr></thead>
        <tbody>${adjustmentRows}</tbody>
    </table>
    <button class="add-adjustment-btn btn-adjustment">+ Add Adjustment</button>
    <button class="save-adjustments-btn btn-save-green">Save All Adjustments</button>
</div>
        <hr>
        <div class="recon-action-buttons">
            <button class="back-to-sale-btn btn-back">← Back to Sale Details</button>
            <button class="save-continue-btn btn-save-green">Save & Continue to Payments →</button>
        </div>`;
	}

	renderAdjustmentsSection() {
		const adjustmentOptions = [
			"Purity Change",
			"Weight Loss - Torching/Cleaning",
			"Weight Adjustment - Stones",
			"Weight Loss - Other",
			"Purity Blend (Melting)",
			"Item Return",
		];

		// Target only the adjustment section body (already rendered)
		const section = this.container.find(".section3-adjustments");
		const tbody = section.find("tbody");

		// Clear any previous rows
		tbody.empty();

		const addRow = () => {
			const idx = tbody.children().length + 1;
			const optionHTML = adjustmentOptions
				.map((o) => `<option value="${o}">${o}</option>`)
				.join("");
			const row = $(`
			<tr data-idx="${idx}">
				<td>${idx}</td>
				<td><select class="adjust-type">${optionHTML}</select></td>
				<td><input type="number" class="from-purity" placeholder="From" /></td>
				<td><input type="number" class="to-purity" placeholder="To" /></td>
				<td><input type="number" class="weight" placeholder="0" /></td>
				<td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
				<td class="profit-impact text-success">+RM 0.00</td>
				<td><button class="btn-delete-row" title="Remove">🗑️</button></td>
			</tr>
		`);
			tbody.append(row);
		};

		// Event bindings
		section.find(".add-adjustment-btn").off("click").on("click", addRow);

		tbody.off("click", ".btn-delete-row").on("click", ".btn-delete-row", function () {
			$(this).closest("tr").remove();
			tbody.find("tr").each((i, tr) =>
				$(tr)
					.find("td:first")
					.text(i + 1)
			);
		});

		section
			.find(".save-adjustments-btn")
			.off("click")
			.on("click", () => {
				const adjustments = [];
				tbody.find("tr").each(function () {
					adjustments.push({
						type: $(this).find(".adjust-type").val(),
						from_purity: $(this).find(".from-purity").val(),
						to_purity: $(this).find(".to-purity").val(),
						weight: $(this).find(".weight").val(),
						notes: $(this).find(".notes").val(),
						impact: $(this).find(".profit-impact").text(),
					});
				});
				console.log("Saved adjustments:", adjustments);
				frappe.show_alert({
					message: "Adjustments saved successfully",
					indicator: "green",
				});
			});

		// Initialize with one default row
		addRow();
	}

	// Payment Entry tab
	renderPaymentEntry() {
		return `<div class="payment-entry-section">
			<h4 class="section-title">Payment Entry Section</h4>
			<p>Payment entry UI goes here.</p>
		</div>`;
	}

	// Bind receipt table events
	bindReceiptEvents() {
		const container = this.container;

		// Add new line
		container.find(".add-receipt-line-btn").on("click", () => {
			const newRow = {
				purity: "",
				weight: 0,
				rate: 0,
				amount: 0,
			};
			this.bagSummary.push(newRow);
			this.render();
		});

		// Delete row
		container.find(".delete-row-btn").on("click", (e) => {
			const idx = $(e.currentTarget).data("idx");
			this.bagSummary.splice(idx, 1);
			this.render();
		});

		// Input changes (no full re-render)
		container.find(".input-weight, .input-rate, .input-amount").on("input", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.index();

			let weight = parseFloat(row.find(".input-weight").val()) || 0;
			let rate = parseFloat(row.find(".input-rate").val()) || 0;
			let amount = parseFloat(row.find(".input-amount").val()) || 0;

			const inputClass = $(e.currentTarget).attr("class");

			// Determine which field was edited and update others accordingly
			if (inputClass.includes("input-weight") && !inputClass.includes("input-amount")) {
				// Weight changed: recalc Amount or Rate
				if (rate > 0) {
					amount = weight * rate;
				} else if (amount > 0 && weight > 0) {
					rate = amount / weight;
				} else {
					amount = 0;
					rate = 0;
				}
			} else if (inputClass.includes("input-rate") && !inputClass.includes("input-amount")) {
				// Rate changed: recalc Amount or Weight
				if (weight > 0) {
					amount = weight * rate;
				} else if (amount > 0 && rate > 0) {
					weight = amount / rate;
				} else {
					amount = 0;
					weight = 0;
				}
			} else if (inputClass.includes("input-amount")) {
				// Amount changed: recalc Rate or Weight
				if (weight > 0) {
					rate = amount / weight;
				} else if (rate > 0) {
					weight = amount / rate;
				} else {
					weight = 0;
					rate = 0;
				}
			}

			// Update inputs with recalculated values
			row.find(".input-weight").val(weight.toFixed(2));
			row.find(".input-rate").val(rate.toFixed(2));
			row.find(".input-amount").val(amount.toFixed(2));

			// Update bagSummary data
			if (this.bagSummary[idx]) {
				this.bagSummary[idx].weight = weight;
				this.bagSummary[idx].rate = rate;
				this.bagSummary[idx].amount = amount;
			}

			// Update total row live for Weight and Amount - keep your existing code here
			let totalWeight = 0,
				totalAmount = 0;
			this.bagSummary.forEach((r) => {
				totalWeight += r.weight || 0;
				totalAmount += r.amount || 0;
			});

			container
				.find(".receipt-table tbody tr:last td:nth-child(3)")
				.text(`${totalWeight.toFixed(2)} g`);
			container
				.find(".receipt-table tbody tr:last td:nth-child(5)")
				.text(`RM ${totalAmount.toFixed(2)}`);
		});
	}

	// Update reconSummary based on bagSummary / inputs
	updateReconSummary() {
		this.reconSummary = this.bagSummary.map((r, idx) => ({
			purity: r.purity,
			actual: r.weight || 0,
			claimed: this.bagSummary[idx].weight || 0,
			cost_basis: this.bagSummary[idx].amount || 0,
			revenue: r.amount || 0,
			profit: (r.amount || 0) - (this.bagSummary[idx].amount || 0),
			profit_g: this.bagSummary[idx].weight
				? ((r.amount || 0) - (this.bagSummary[idx].amount || 0)) /
				  this.bagSummary[idx].weight
				: 0,
			margin_percent: this.bagSummary[idx].amount
				? (((r.amount || 0) - (this.bagSummary[idx].amount || 0)) /
						this.bagSummary[idx].amount) *
				  100
				: 0,
		}));
	}
}
