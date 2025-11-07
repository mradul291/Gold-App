// Updated flow after - Purity Change
class Step3TabReceiptReconciliation {
	constructor(props, container, backCallback, continueCallback, syncDataCallback) {
		this.props = props;
		this.container = container;
		this.backCallback = backCallback;
		this.continueCallback = continueCallback;
		this.syncDataCallback = syncDataCallback;
		this.reconSummary = props.reconSummary.length
			? props.reconSummary
			: this.initializeReconSummary();
		this.adjustments = props.adjustments;
		this.bagSummary = [];
		this.uploadedReceiptUrl = "";
		this.availablePurities = [];

		this.fetchPuritiesFromDoctype().then((purities) => {
			this.availablePurities = purities;
			this.render();
			this.bindReceiptEvents();
			this.bindUploadReceipt();
			this.renderAdjustmentsSection();
			this.attachNavHandlers();
		});
	}

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

	renderAndBindAll() {
		this.render();
		this.bindReceiptEvents();
		this.bindUploadReceipt();
		this.renderAdjustmentsSection();
		this.attachNavHandlers();
		this.updateReconciliationSummary();
	}

	async fetchPuritiesFromDoctype() {
		try {
			const response = await frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Purity",
					fields: ["name"],
					limit_page_length: 100,
					order_by: "name asc",
				},
			});
			// Extract purity names from result
			return response.message.map((item) => item.name);
		} catch (error) {
			console.error("Error fetching purities:", error);
			return [];
		}
	}

	render() {
		this.container.html(`
        <div class="section1-buyer-receipt">
            <h4 class="section-title">Section 1: Buyer's Official Receipt</h4>
            <p class="input-caption">Enter what the buyer actually paid for</p>
            <table class="receipt-table">
                <thead><tr><th>Move</th><th>Purity</th><th>Weight (g) *</th><th>Rate (RM/g)</th><th>Amount (RM)</th><th>Action</th></tr></thead>
                <tbody></tbody>
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
                <tbody></tbody>
            </table>
        </div>
        <hr>
        <div class="section3-adjustments">
            <h4 class="section-title">Section 3: Adjustments</h4>
            <p class="input-caption">Add adjustment rows until Claimed = Actual</p>
            <table class="adjust-table">
                <thead><tr><th>#</th><th>Adjustment Type</th><th>From Purity</th><th>To Purity</th><th>Weight (g)</th><th>Notes / Remarks</th><th>Profit Impact</th><th>Delete</th></tr></thead>
                <tbody></tbody>
            </table>
            <button class="add-adjustment-btn btn-adjustment">+ Add Adjustment</button>
            <button class="save-adjustments-btn btn-save-green">Save All Adjustments</button>
        </div>
        <hr>
        <div class="recon-action-buttons">
            <button class="back-to-sale-btn btn-back">← Back to Sale Details</button>
            <button class="save-continue-btn btn-save-green">Save & Continue to Payments →</button>
        </div>
    `);

		// Call three section renders to fill tbody's
		this.renderReceiptSection();
		this.renderReconciliationSection();
		this.renderAdjustmentsSection();
	}

	renderReceiptSection() {
		const purities = this.availablePurities;

		// Helper to build options html
		const purityOptions = (selected) => {
			const blankOption = `<option value="" ${
				selected === "" ? "selected" : ""
			} disabled>Select</option>`;
			const otherOptions = purities
				.map(
					(p) => `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`
				)
				.join("");
			return blankOption + otherOptions;
		};

		const receiptLines = this.bagSummary
			.map(
				(r, idx) => `
            <tr data-idx="${idx}">
                <td><span class="move-arrows"><span class="up-arrow">&#9650;</span><span class="down-arrow">&#9660;</span></span></td>
             <td>
  <input list="purity-list-${idx}" class="input-purity" value="${r.purity}">
  <datalist id="purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                <td><input type="number" class="input-weight" value="${
					r.weight ? r.weight.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-rate" value="${
					r.rate ? r.rate.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-amount" value="${
					r.amount ? r.amount.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><button class="delete-row-btn" data-idx="${idx}">&#128465;</button></td>
            </tr>
        `
			)
			.join("");

		const receiptTable = this.container.find(
			".section1-buyer-receipt table.receipt-table tbody"
		);
		if (receiptTable.length) {
			receiptTable.html(`${receiptLines}
            <tr class="footer-total">
                <td colspan="2">TOTAL</td>
                <td class="total-weight">0.00 g</td>
                <td>-</td>
                <td class="total-amount">RM 0.00</td>
                <td></td>
            </tr>`);
		} else {
			// Initial render case - call full render to set HTML first
			this.render();
		}
	}

	renderReconciliationSection() {
		const reconRows = this.reconSummary
			.map(
				(r) => `
            <tr data-idx="${r.purity}" data-purity="${r.purity}">
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
            </tr>
        `
			)
			.join("");

		this.container.find(".section2-recon-summary table.recon-table tbody").html(reconRows);
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
		const section = this.container.find(".section3-adjustments");
		const tbody = section.find("tbody");
		tbody.empty();
		const purities = this.availablePurities; // get fresh purity list
		const addRow = () => {
			const idx = tbody.children().length + 1;
			const optionHTML = adjustmentOptions
				.map((o) => `<option value="${o}">${o}</option>`)
				.join("");

			const row = $(`
                <tr data-idx="${idx}">
                    <td>${idx}</td>
                    <td><select class="adjust-type">${optionHTML}</select></td>
                    <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                    <td><input type="number" class="weight" placeholder="0" /></td>
                    <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
                    <td class="profit-impact text-success">+RM 0.00</td>
                    <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
                </tr>
            `);
			tbody.append(row);
			// update the impact display for this freshly-added row
			this.computeProfitImpactForRow(tbody.find("tr").last());
		};

		section
			.find(".add-adjustment-btn")
			.off("click")
			.on("click", () => {
				const tbody = section.find("tbody");
				const idx = tbody.children().length + 1;
				const optionHTML = adjustmentOptions
					.map((o) => `<option value="${o}">${o}</option>`)
					.join("");
				const purities = this.availablePurities;
				const row = $(`
        <tr data-idx="${idx}">
            <td>${idx}</td>
            <td><select class="adjust-type">${optionHTML}</select></td>
          <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

            <td><input type="number" class="weight" placeholder="0" /></td>
            <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
            <td class="profit-impact text-success">+RM 0.00</td>
            <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
        </tr>
    `);
				tbody.append(row);
				this.bindAdjustmentEvents();
				this.updateReconciliationSummary();
			});

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
				if (!this.isFullyReconciled()) {
					frappe.msgprint({
						title: "Reconciliation Incomplete",
						message:
							"Please complete reconciliation (Δ = 0) for all purities before saving.",
						indicator: "orange",
					});
					return;
				}
				// Update adjustments from UI inputs
				const adjustments = [];
				tbody.find("tr").each((_, tr) => {
					const row = $(tr);
					adjustments.push({
						type: row.find(".adjust-type").val(),
						from_purity: row.find(".from-purity").val(),
						to_purity: row.find(".to-purity").val(),
						weight: row.find(".weight").val(),
						notes: row.find(".notes").val(),
						impact: row.find(".profit-impact").text(),
					});
				});
				this.adjustments = adjustments;
				this.onClickSaveAdjustments();
			});

		addRow();

		// After "addRow();" and after setting up existing handlers:

		// Handler for ANY adjustment value changes (type, from_purity, weight)
		// canonical single handler for adjustment input changes
		tbody.off("input.adjust-update").on("input.adjust-update", "input,select", () => {
			// Recompute per-row profit impact and sync adjustments array
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const $tr = $(tr);
				// compute numeric impact and update cell
				const numericImpact = this.computeProfitImpactForRow($tr);

				this.adjustments.push({
					type: $tr.find(".adjust-type").val(),
					from_purity: $tr.find(".from-purity").val(),
					to_purity: $tr.find(".to-purity").val(),
					weight: $tr.find(".weight").val(),
					notes: $tr.find(".notes").val(),
					impact: numericImpact, // store numeric impact for persistence
				});
			});
			// Refresh reconciliation summary to apply aggregated impacts
			this.updateReconciliationSummary();
		});

		// Function to toggle visibility of 'To Purity' field in a given row based on selected adjustment type
		const toggleToPurityField = (row) => {
			const adjustmentType = row.find(".adjust-type").val();
			const toPurityInput = row.find(".to-purity");
			const fromPurityInput = row.find(".from-purity");
			if (adjustmentType === "Item Return") {
				toPurityInput.val("").hide().prop("readonly", false);
			} else if (
				adjustmentType === "Weight Loss - Torching/Cleaning" ||
				adjustmentType === "Weight Loss - Other" ||
				adjustmentType === "Weight Adjustment - Stones"
			) {
				toPurityInput.show().prop("readonly", true);
				toPurityInput.val(fromPurityInput.val());
			} else {
				toPurityInput.show().prop("readonly", false);
			}
		};

		// Initial toggle on all existing rows
		tbody.find("tr").each((_, tr) => {
			toggleToPurityField($(tr));
		});

		// Event handler for change on adjustment type select dropdown
		tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
			const row = $(e.currentTarget).closest("tr");
			toggleToPurityField(row);
			// Same as above: refresh adjustments and update recon
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const row = $(tr);
				this.adjustments.push({
					type: row.find(".adjust-type").val(),
					from_purity: row.find(".from-purity").val(),
					to_purity: row.find(".to-purity").val(),
					weight: row.find(".weight").val(),
					notes: row.find(".notes").val(),
					impact: row.find(".profit-impact").text(),
				});
			});
			this.updateReconciliationSummary();
		});

		// Real-time sync from_purity to to_purity for weight loss rows
		tbody.on("input", ".from-purity", function () {
			const row = $(this).closest("tr");
			const adjustmentType = row.find(".adjust-type").val();
			if (
				adjustmentType === "Weight Loss - Torching/Cleaning" ||
				adjustmentType === "Weight Loss - Other" ||
				adjustmentType === "Weight Adjustment - Stones"
			) {
				row.find(".to-purity").val($(this).val());
			}
		});
	}

	attachNavHandlers() {
		this.container.find(".back-to-sale-btn").on("click", this.backCallback);
		container
			.find(".save-continue-btn")
			.off("click")
			.on("click", async () => {
				try {
					await this.callCreateSalesAndDeliveryAPI();
					frappe.show_alert({
						message: "Sales and Delivery created successfully",
						indicator: "green",
					});
					if (this.continueCallback) this.continueCallback();
				} catch (error) {
					frappe.msgprint({
						title: "Error",
						message: `Failed to create sales and delivery: ${error.message}`,
						indicator: "red",
					});
				}
			});
	}

	bindReceiptEvents() {
		const container = this.container;

		container
			.find(".add-receipt-line-btn")
			.off("click")
			.on("click", () => {
				const newRow = {
					purity: "",
					weight: 0,
					rate: 0,
					amount: 0,
				};
				this.bagSummary.push(newRow);
				this.renderReceiptSection();
				this.bindReceiptEvents(); // Re-bind receipt events
				this.updateReconciliationSummary();
			});

		container.on("click", ".delete-row-btn", (e) => {
			const idx = $(e.currentTarget).data("idx");
			this.bagSummary.splice(idx, 1); // Remove from data array

			$(e.currentTarget).closest("tr").remove();

			this.renderReceiptSection();
			this.bindReceiptEvents();
			this.updateReconciliationSummary();
		});

		// Purity field event handler
		container.on("input", ".input-purity", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.data("idx");
			this.bagSummary[idx].purity = $(e.currentTarget).val();
		});

		container.find(".input-weight, .input-rate, .input-amount").on("blur", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.index();

			let weight = parseFloat(row.find(".input-weight").val()) || 0;
			let rate = parseFloat(row.find(".input-rate").val()) || 0;
			let amount = parseFloat(row.find(".input-amount").val()) || 0;
			const inputClass = $(e.currentTarget).attr("class");

			if (inputClass.includes("input-weight") && !inputClass.includes("input-amount")) {
				if (rate > 0) {
					amount = weight * rate;
				} else if (amount > 0 && weight > 0) {
					rate = amount / weight;
				} else {
					amount = 0;
					rate = 0;
				}
			} else if (inputClass.includes("input-rate") && !inputClass.includes("input-amount")) {
				if (weight > 0) {
					amount = weight * rate;
				} else if (amount > 0 && rate > 0) {
					weight = amount / rate;
				} else {
					amount = 0;
					weight = 0;
				}
			} else if (inputClass.includes("input-amount")) {
				if (weight > 0) {
					rate = amount / weight;
				} else if (rate > 0) {
					weight = amount / rate;
				} else {
					weight = 0;
					rate = 0;
				}
			}

			// Format on blur: always to 2 decimals
			row.find(".input-weight").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});
			row.find(".input-rate").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});
			row.find(".input-amount").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});

			if (this.bagSummary[idx]) {
				this.bagSummary[idx].weight = weight;
				this.bagSummary[idx].rate = rate;
				this.bagSummary[idx].amount = amount;
			}

			let totalWeight = 0,
				totalAmount = 0;
			this.bagSummary.forEach((r) => {
				totalWeight += r.weight || 0;
				totalAmount += r.amount || 0;
			});

			container
				.find(".receipt-table .footer-total .total-weight")
				.text(`${totalWeight.toFixed(2)} g`);
			container
				.find(".receipt-table .footer-total .total-amount")
				.text(`RM ${totalAmount.toFixed(2)}`);
			this.updateReconciliationSummary();
		});

		container.find(".input-weight, .input-amount").on("input", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.index();

			let weight = parseFloat(row.find(".input-weight").val()) || 0;
			let amount = parseFloat(row.find(".input-amount").val()) || 0;

			if (weight > 0 && amount > 0) {
				const rate = amount / weight;
				row.find(".input-rate").val(rate.toFixed(2));
				if (this.bagSummary[idx]) {
					this.bagSummary[idx].rate = rate;
				}
			} else {
				row.find(".input-rate").val("0.00");
				if (this.bagSummary[idx]) {
					this.bagSummary[idx].rate = 0;
				}
			}
		});

		container.on("input", ".input-weight, .input-amount", () => {
			let totalWeight = 0,
				totalAmount = 0;
			container.find(".receipt-table tbody tr").each(function () {
				const weight = parseFloat($(this).find(".input-weight").val()) || 0;
				const amount = parseFloat($(this).find(".input-amount").val()) || 0;
				totalWeight += weight;
				totalAmount += amount;
			});

			container
				.find(".receipt-table .footer-total .total-weight")
				.text(`${totalWeight.toFixed(2)} g`);
			container
				.find(".receipt-table .footer-total .total-amount")
				.text(`RM ${totalAmount.toFixed(2)}`);
		});

		container
			.find(".up-arrow, .down-arrow")
			.off("click")
			.on("click", (e) => {
				const isUp = $(e.currentTarget).hasClass("up-arrow");
				const row = $(e.currentTarget).closest("tr");
				if (isUp) {
					const prevRow = row.prev("tr");
					if (prevRow.length && !prevRow.hasClass("footer-total")) {
						row.insertBefore(prevRow);
					}
				} else {
					const nextRow = row.next("tr");
					if (nextRow.length && !nextRow.hasClass("footer-total")) {
						row.insertAfter(nextRow);
					}
				}
				const updatedSummary = [];
				container.find(".receipt-table tbody tr[data-idx]").each((i, tr) => {
					const idx = $(tr).data("idx");
					if (this.bagSummary[idx]) {
						updatedSummary.push(this.bagSummary[idx]);
					}
				});
				this.bagSummary = updatedSummary;
			});

		container
			.find(".save-continue-btn")
			.off("click")
			.on("click", async () => {
				if (!this.isFullyReconciled()) {
					frappe.msgprint({
						title: "Reconciliation Incomplete",
						message:
							"Please complete reconciliation (Δ = 0) for all purities before continuing to payments.",
						indicator: "orange",
					});
					return;
				}
				try {
					await this.callCreateSalesAndDeliveryAPI();
					frappe.show_alert({
						message: "Sales and Delivery created successfully",
						indicator: "green",
					});
					if (this.continueCallback) this.continueCallback();
				} catch (error) {
					frappe.msgprint({
						title: "Error",
						message: `Failed to create sales and delivery: ${error.message}`,
						indicator: "red",
					});
				}
			});
	}

	updateReconciliationSummary() {
		const container = this.container;

		// Precompute adjustment weight maps by type (per purity)
		const itemReturnMap = {};
		const weightLossMap = {};
		const weightAdjustStonesMap = {};
		const purityChangeOutMap = {}; // weights moved out from a purity
		const purityChangeInMap = {}; // weights moved into a purity

		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			const from = (adj.from_purity || "").trim();
			const to = (adj.to_purity || "").trim();
			const wt = parseFloat(adj.weight) || 0;

			if (!wt) return;

			if (type === "Item Return") {
				itemReturnMap[from] = (itemReturnMap[from] || 0) + wt;
			} else if (
				type === "Weight Loss - Torching/Cleaning" ||
				type === "Weight Loss - Other"
			) {
				weightLossMap[from] = (weightLossMap[from] || 0) + wt;
			} else if (type === "Weight Adjustment - Stones") {
				weightAdjustStonesMap[from] = (weightAdjustStonesMap[from] || 0) + wt;
			} else if (type === "Purity Change" || type === "Purity Blend (Melting)") {
				// For purity change, treat as moving wt from 'from' to 'to'
				purityChangeOutMap[from] = (purityChangeOutMap[from] || 0) + wt;
				purityChangeInMap[to] = (purityChangeInMap[to] || 0) + wt;
			}
		});

		// Build aggregated monetary impacts per purity (consistent with computeProfitImpactForRow)
		const adjustmentImpactMap = {}; // numeric RM adjustments per purity
		const { unit_revenue: __ur, unit_cost: __uc } = this.computeUnitMaps
			? this.computeUnitMaps()
			: { unit_revenue: {}, unit_cost: {} };

		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			const from = (adj.from_purity || "").trim();
			const to = (adj.to_purity || "").trim();
			const wt = parseFloat(adj.weight) || 0;
			if (!wt) return;

			const urFrom = (__ur && __ur[from]) || 0;
			const ucFrom = (__uc && __uc[from]) || 0;
			const urTo = (__ur && __ur[to]) || 0;
			const ucTo = (__uc && __uc[to]) || 0;

			let impactFrom = 0;
			let impactTo = 0;

			if (type === "Item Return") {
				impactFrom = -(urFrom - ucFrom) * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (
				type === "Weight Loss - Torching/Cleaning" ||
				type === "Weight Loss - Other"
			) {
				impactFrom = -urFrom * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (type === "Weight Adjustment - Stones") {
				impactFrom = (urFrom - ucFrom) * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (type === "Purity Change" || type === "Purity Blend (Melting)") {
				// margin difference moved from => to
				const margin_from = urFrom - ucFrom;
				const margin_to = urTo - ucTo;
				const net = (margin_to - margin_from) * wt;
				// net is positive if moving increases overall margin, negative otherwise.
				// Allocate negative impact on 'from' and positive on 'to'
				impactFrom = -net; // remove margin from 'from' (show as negative)
				impactTo = net; // add margin to 'to'
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
				adjustmentImpactMap[to] = (adjustmentImpactMap[to] || 0) + impactTo;
			}
		});

		// Iterate receipt rows and update reconciliation table rows
		const rows = container.find(".receipt-table tbody tr[data-idx]");

		// For faster lookup, load recon rows by purity key
		const reconMap = {};
		container.find(".recon-table tbody tr[data-purity]").each((_, r) => {
			const $r = $(r);
			const p = ($r.data("purity") || "").toString().trim();
			if (p) reconMap[p] = $r;
		});

		// We'll also update any recon rows that have no receipt row (e.g., a 'to' purity that only gets increased)
		// But first update based on receipt rows to get actual weights.
		rows.each((_, rowElem) => {
			const row = $(rowElem);
			const purityVal = (row.find(".input-purity").val() || "").toString().trim();
			const purity = purityVal || "";
			const weight = parseFloat(row.find(".input-weight").val()) || 0;
			const rate = parseFloat(row.find(".input-rate").val()) || 0;
			const amountInput = parseFloat(row.find(".input-amount").val());
			const amount = isNaN(amountInput) ? weight * rate : amountInput;

			if (!purity || !reconMap[purity]) return;

			const reconRow = reconMap[purity];
			let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;

			// Apply adjustments affecting this purity:
			const itemReturnWeight = itemReturnMap[purity] || 0;
			const weightLoss = weightLossMap[purity] || 0;
			const weightAdjustStones = weightAdjustStonesMap[purity] || 0;
			const purityOut = purityChangeOutMap[purity] || 0; // moved out
			const purityIn = purityChangeInMap[purity] || 0; // moved in

			// Effective claimed = baseClaimed - out (item return + purity out + weight loss) + in (purity in + stones adjust)
			const claimed =
				baseClaimed -
				itemReturnWeight -
				weightLoss -
				purityOut +
				purityIn +
				weightAdjustStones;

			// Show strikethrough -> new claimed when it changed
			if (Math.abs(claimed - baseClaimed) > 0.0009) {
				// If claimed decreased show original -> new, likewise for increase
				reconRow
					.find(".claimed-cell")
					.html(`<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`);
			} else {
				reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
			}

			// Actual is the physical weight in Section 1 for this row
			const actual = weight;
			const delta = (actual - claimed).toFixed(2);

			// Cost basis read from UI (existing behavior)
			const baseCostBasis =
				parseFloat(
					reconRow
						.find(".cost-basis")
						.text()
						.replace(/[^\d.-]/g, "")
				) || 0;

			// Compute revenue/profit,
			let revenue = 0,
				profit = 0,
				profitG = 0,
				margin = 0;
			let statusHTML = "";

			// When actual equals claimed and amount equals cost_basis (earlier logic)
			if (Math.abs(actual - claimed) < 0.001 && Math.abs(amount - baseCostBasis) < 0.001) {
				statusHTML = '<span class="status-icon success">&#10004;</span>';
				reconRow.addClass("recon-row-green");
			} else {
				revenue = amount;
				profit = revenue - baseCostBasis;

				// Apply aggregated adjustment impact for this purity (if any)
				const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
				profit += adjImpactForPurity;

				profitG = actual ? profit / actual : 0;
				margin = revenue ? (profit / revenue) * 100 : 0;

				const totalWeightAdjustments =
					itemReturnWeight + weightLoss + purityOut + weightAdjustStones - purityIn;
				// Adjust status logic conservatively: success if positive profit/g or revenue > cost (as before)
				if (
					(profit > 0 && totalWeightAdjustments > 0) ||
					profitG > 0 ||
					revenue > baseCostBasis
				) {
					statusHTML = '<span class="status-icon success">&#10004;</span>';
					reconRow.addClass("recon-row-green");
				} else {
					statusHTML = '<span class="status-icon warning">&#9888;</span>';
					reconRow.removeClass("recon-row-green");
				}
			}

			// Update reconciliation cells
			reconRow.find(".actual-cell").text(actual.toFixed(2));
			reconRow.find(".delta-cell").text(delta);
			reconRow
				.find(".revenue-cell")
				.text(`RM ${revenue.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow
				.find(".profit-cell")
				.text(`RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow
				.find(".profit-g-cell")
				.text(`RM ${profitG.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
			reconRow.find(".status-cell").html(statusHTML);
		});

		// Additionally, update recon rows that are present in reconciliation table but not linked to a receipt row:
		// (these might be pure 'to' purities that just got increased)
		Object.keys(reconMap).forEach((purity) => {
			// if there is no receipt-row with this purity, still update the claimed to reflect purityChangeInMap
			const reconRow = reconMap[purity];
			const hasReceiptRow = !!container
				.find(`.receipt-table tbody tr[data-idx] .input-purity`)
				.filter(function () {
					return ($(this).val() || "").trim() === purity;
				}).length;

			if (!hasReceiptRow) {
				let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;

				const purityIn = purityChangeInMap[purity] || 0;
				const purityOut = purityChangeOutMap[purity] || 0;
				const itemReturnWeight = itemReturnMap[purity] || 0;
				const weightLoss = weightLossMap[purity] || 0;
				const weightAdjustStones = weightAdjustStonesMap[purity] || 0;

				const claimed =
					baseClaimed -
					itemReturnWeight -
					weightLoss -
					purityOut +
					purityIn +
					weightAdjustStones;

				if (Math.abs(claimed - baseClaimed) > 0.0009) {
					reconRow
						.find(".claimed-cell")
						.html(`<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`);
				} else {
					reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
				}

				// For these, actual remains whatever existing value is (likely 0), so just update claimed and impacts
				const actual = parseFloat(reconRow.find(".actual-cell").text()) || 0;
				const delta = (actual - claimed).toFixed(2);

				let baseCostBasis =
					parseFloat(
						reconRow
							.find(".cost-basis")
							.text()
							.replace(/[^\d.-]/g, "")
					) || 0;

				let revenue = 0,
					profit = 0,
					profitG = 0,
					margin = 0;
				let statusHTML = "";

				const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
				profit = revenue - baseCostBasis + adjImpactForPurity;
				profitG = actual ? profit / actual : 0;
				margin = revenue ? (profit / revenue) * 100 : 0;

				if (profit > 0 || profitG > 0) {
					statusHTML = '<span class="status-icon success">&#10004;</span>';
					reconRow.addClass("recon-row-green");
				} else {
					statusHTML = '<span class="status-icon warning">&#9888;</span>';
					reconRow.removeClass("recon-row-green");
				}

				reconRow.find(".delta-cell").text(delta);
				reconRow
					.find(".profit-cell")
					.text(`RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
				reconRow
					.find(".profit-g-cell")
					.text(`RM ${profitG.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
				reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
				reconRow.find(".status-cell").html(statusHTML);
			}
		});
	}

	bindAdjustmentEvents() {
		const tbody = this.container.find(".section3-adjustments tbody");

		tbody.off("click", ".btn-delete-row").on("click", ".btn-delete-row", (e) => {
			$(e.currentTarget).closest("tr").remove();
			tbody.find("tr").each((i, tr) => {
				$(tr)
					.find("td:first")
					.text(i + 1);
			});
			this.updateReconciliationSummary();
		});

		tbody.off("input.adjust-update").on("input.adjust-update", "input,select", () => {
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const row = $(tr);
				this.adjustments.push({
					type: row.find(".adjust-type").val(),
					from_purity: row.find(".from-purity").val(),
					to_purity: row.find(".to-purity").val(),
					weight: row.find(".weight").val(),
					notes: row.find(".notes").val(),
					impact: row.find(".profit-impact").text(),
				});
			});
			this.updateReconciliationSummary();
		});

		tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
			const row = $(e.currentTarget).closest("tr");
			this.toggleToPurityField(row);
			this.updateReconciliationSummary();
		});

		tbody.off("input", ".from-purity").on("input", ".from-purity", function () {
			const row = $(this).closest("tr");
			const adjustmentType = row.find(".adjust-type").val();
			if (
				[
					"Weight Loss - Torching/Cleaning",
					"Weight Loss - Other",
					"Weight Adjustment - Stones",
				].includes(adjustmentType)
			) {
				row.find(".to-purity").val($(this).val());
			}
		});
	}

	isFullyReconciled() {
		let reconciled = true;
		this.container.find(".recon-table tbody tr").each((_, tr) => {
			const delta = parseFloat($(tr).find(".delta-cell").text());
			const isGreen = $(tr).hasClass("recon-row-green");
			if (Math.abs(delta) > 0.001 || !isGreen) {
				reconciled = false;
				return false; // exit loop early if any row fails
			}
		});
		return reconciled;
	}

	async callCreateSalesAndDeliveryAPI() {
		if (!this.props.customer) {
			throw new Error("Customer info missing.");
		}

		const warehouse = this.props.selected_bag + " - AGSB";
		const items = this.bagSummary.map((line) => {
			const purityStr = line.purity || "";
			return {
				item_code: `Unsorted-${purityStr}`,
				purity: purityStr,
				weight: parseFloat(line.weight) || 0,
				rate: parseFloat(line.rate) || 0,
				warehouse: warehouse,
			};
		});

		const payload = {
			customer: this.props.customer,
			items: JSON.stringify(items),
			company: this.props.company || null,
		};

		await new Promise((resolve, reject) => {
			frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.create_sales_invoice",
				args: payload,
				callback: (r) => {
					console.log("API response:", r);
					if (r.message && r.message.status === "success") {
						resolve(r.message);
					} else {
						reject(new Error("API returned failure"));
					}
				},
				errorHandler: (err) => {
					console.error("API call error:", err);
					reject(err);
				},
			});
		});
	}

	bindUploadReceipt() {
		const container = this.container;
		if (container.find("#hidden-upload-input").length === 0) {
			const fileInput = $(
				'<input type="file" id="hidden-upload-input" style="display:none" />'
			);
			container.append(fileInput);
			fileInput.on("change", (e) => {
				const file = e.target.files[0];
				if (!file) return;
				this.pendingReceiptFile = file; // Save the file object for later
				frappe.show_alert({
					message: `Receipt "${file.name}" selected, will be uploaded on Save.`,
					indicator: "green",
				});
			});
		}
		container
			.find(".btn-upload-receipt")
			.off("click")
			.on("click", () => {
				container.find("#hidden-upload-input").click();
			});
	}

	uploadReceiptFile(transactionName) {
		if (!this.pendingReceiptFile) return;
		const file = this.pendingReceiptFile;
		const reader = new FileReader();
		reader.onload = (ev) => {
			frappe.call({
				method: "frappe.client.attach_file",
				args: {
					doctype: "Wholesale Transaction",
					docname: transactionName, // now the valid docname!
					filedata: ev.target.result.split(",")[1],
					filename: file.name,
					is_private: 1,
				},
				callback: (r) => {
					if (r.message && r.message.file_url) {
						// Update the transaction's upload_receipt field after attaching
						frappe.call({
							method: "frappe.client.set_value",
							args: {
								doctype: "Wholesale Transaction",
								name: transactionName,
								fieldname: "upload_receipt",
								value: r.message.file_url,
							},
							callback: () => {
								frappe.show_alert({
									message: "Receipt file linked successfully!",
									indicator: "green",
								});
							},
						});
					}
				},
			});
		};
		reader.readAsDataURL(file);
	}

	onClickSaveAdjustments() {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Wholesale Transaction",
				filters: { wholesale_bag: this.props.selected_bag },
				fields: ["name"],
			},
			callback: (res) => {
				let transactionDoc = {
					doctype: "Wholesale Transaction",
					wholesale_bag: this.props.selected_bag,
					buyer: this.props.customer,
					buyer_name: this.props.buyer_name || "",
					sale_date: this.props.sale_date,
					total_cost_basis: this.props.totalAmount,
					receipt_lines: this.bagSummary.map((line) => ({
						purity: line.purity,
						weight: line.weight,
						rate: line.rate,
						amount: line.amount,
					})),
					reconciliation_lines: [],
					adjustments: this.adjustments.map((adj) => ({
						adjustment_type: adj.type,
						from_purity: adj.from_purity,
						to_purity: adj.to_purity,
						weight: adj.weight,
						notes: adj.notes,
						profit_impact: adj.impact,
					})),
				};

				this.container.find(".recon-table tbody tr").each((_, tr) => {
					const $tr = $(tr);
					transactionDoc.reconciliation_lines.push({
						purity: $tr.find("td:eq(0)").text().trim(),
						actual: parseFloat($tr.find(".actual-cell").text()) || 0,
						claimed: parseFloat($tr.find(".claimed-cell").text()) || 0,
						delta: parseFloat($tr.find(".delta-cell").text()) || 0,
						status: $tr.find(".status-cell").text().trim() || "",
						cost_basis:
							parseFloat(
								$tr
									.find(".cost-basis")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						revenue:
							parseFloat(
								$tr
									.find(".revenue-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						profit:
							parseFloat(
								$tr
									.find(".profit-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						profit_g:
							parseFloat(
								$tr
									.find(".profit-g-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						margin_percent: parseFloat($tr.find(".margin-cell").text()) || 0,
					});
				});

				// 1. Transaction exists: update, then upload
				if (res.message && res.message.length > 0) {
					const docname = res.message[0].name;

					frappe.call({
						method: "frappe.client.get",
						args: { doctype: "Wholesale Transaction", name: docname },
						callback: (r) => {
							if (r.message) {
								Object.assign(r.message, transactionDoc);
								frappe.call({
									method: "frappe.client.save",
									args: { doc: r.message },
									callback: (saveRes) => {
										frappe.show_alert({
											message: "Transaction updated successfully.",
											indicator: "green",
										});
										this.uploadReceiptFile(docname); // <- Always use docname!
									},
									error: (e) => {
										frappe.msgprint("Update failed: " + (e.message || e));
									},
								});
							}
						},
						error: (e) => {
							frappe.msgprint("Failed to fetch latest doc: " + (e.message || e));
						},
					});
				} else {
					// 2. New transaction: insert, then upload receipt
					frappe.call({
						method: "frappe.client.insert",
						args: { doc: transactionDoc },
						callback: (insertRes) => {
							frappe.show_alert({
								message: "Transaction saved successfully.",
								indicator: "green",
							});
							if (insertRes.message && insertRes.message.name) {
								this.uploadReceiptFile(insertRes.message.name); // <- Use the REAL docname!
							}
						},
						error: (e) => {
							frappe.msgprint("Save failed: " + (e.message || e));
						},
					});
				}
			},
			error: (e) => {
				frappe.msgprint("Error searching for transaction: " + (e.message || e));
			},
		});
	}

	// Prfit Impact
	computeUnitMaps() {
		const unit_revenue = {};
		const unit_cost = {};

		// Build unit_revenue from receipt-table rows
		this.container.find(".receipt-table tbody tr[data-idx]").each((_, tr) => {
			const $tr = $(tr);
			const purity = ($tr.find(".input-purity").val() || "").trim();
			const w = parseFloat($tr.find(".input-weight").val()) || 0;
			const a = parseFloat($tr.find(".input-amount").val()) || 0;
			if (purity && w > 0) {
				// If multiple rows for same purity, last one will overwrite; acceptable for simplicity.
				unit_revenue[purity] = a / w;
			}
		});

		// Build unit_cost from reconSummary (use DOM cost-basis cell as source of truth)
		this.container.find(".recon-table tbody tr[data-purity]").each((_, tr) => {
			const $tr = $(tr);
			const purity = $tr.data("purity");
			const claimed =
				parseFloat(
					$tr
						.find(".claimed-cell")
						.text()
						.replace(/[^\d.-]/g, "")
				) || 0;
			const costText = $tr
				.find(".cost-basis")
				.text()
				.replace(/[^\d.-]/g, "");
			const cost = parseFloat(costText) || 0;
			if (purity && claimed > 0) {
				unit_cost[purity] = cost / claimed;
			} else {
				unit_cost[purity] = 0;
			}
		});

		return { unit_revenue, unit_cost };
	}

	computeProfitImpactForRow($row) {
		const type = $row.find(".adjust-type").val();
		const from = ($row.find(".from-purity").val() || "").trim();
		const to = ($row.find(".to-purity").val() || "").trim();
		const weight = parseFloat($row.find(".weight").val()) || 0;

		const { unit_revenue, unit_cost } = this.computeUnitMaps();

		const getUR = (p) => unit_revenue[p] || 0;
		const getUC = (p) => unit_cost[p] || 0;

		let impact = 0;

		switch (type) {
			case "Item Return":
				// Profit lost = gross margin per g * weight
				impact = -(getUR(from) - getUC(from)) * weight;
				break;
			case "Weight Loss - Torching/Cleaning":
			case "Weight Loss - Other":
				// Revenue lost (conservative)
				impact = -getUR(from) * weight;
				break;
			case "Weight Adjustment - Stones":
				// Stones removal increases saleable weight → gains margin
				impact = (getUR(from) - getUC(from)) * weight;
				break;
			case "Purity Change":
			case "Purity Blend (Melting)":
				// Move from -> to: net change = (margin_to - margin_from) * weight
				const margin_to = getUR(to) - getUC(to);
				const margin_from = getUR(from) - getUC(from);
				impact = (margin_to - margin_from) * weight;
				break;
			default:
				impact = 0;
		}

		// Update UI cell text with sign and two decimals
		// --- Update UI cell styling and text based on sign ---
		const $impactCell = $row.find(".profit-impact");
		const sign = impact >= 0 ? "+" : "-";
		const absVal = Math.abs(impact).toFixed(2);
		$impactCell.text(`${sign}RM ${absVal}`);

		// Apply color classes
		if (impact >= 0) {
			$impactCell.removeClass("text-danger").addClass("text-success");
		} else {
			$impactCell.removeClass("text-success").addClass("text-danger");
		}

		// return signed numeric value
		return impact;
	}
}

//Purity Blend
class Step3TabReceiptReconciliation {
	constructor(props, container, backCallback, continueCallback, syncDataCallback) {
		this.props = props;
		this.container = container;
		this.backCallback = backCallback;
		this.continueCallback = continueCallback;
		this.syncDataCallback = syncDataCallback;
		this.reconSummary = props.reconSummary.length
			? props.reconSummary
			: this.initializeReconSummary();
		this.adjustments = props.adjustments;
		this.bagSummary = [];
		this.uploadedReceiptUrl = "";
		this.availablePurities = [];

		this.fetchPuritiesFromDoctype().then((purities) => {
			this.availablePurities = purities;
			this.render();
			this.bindReceiptEvents();
			this.bindUploadReceipt();
			this.renderAdjustmentsSection();
			this.attachNavHandlers();
		});
	}

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

	renderAndBindAll() {
		this.render();
		this.bindReceiptEvents();
		this.bindUploadReceipt();
		this.renderAdjustmentsSection();
		this.attachNavHandlers();
		this.updateReconciliationSummary();
	}

	async fetchPuritiesFromDoctype() {
		try {
			const response = await frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Purity",
					fields: ["name"],
					limit_page_length: 100,
					order_by: "name asc",
				},
			});
			// Extract purity names from result
			return response.message.map((item) => item.name);
		} catch (error) {
			console.error("Error fetching purities:", error);
			return [];
		}
	}

	render() {
		this.container.html(`
        <div class="section1-buyer-receipt">
            <h4 class="section-title">Section 1: Buyer's Official Receipt</h4>
            <p class="input-caption">Enter what the buyer actually paid for</p>
            <table class="receipt-table">
                <thead><tr><th>Move</th><th>Purity</th><th>Weight (g) *</th><th>Rate (RM/g)</th><th>Amount (RM)</th><th>Action</th></tr></thead>
                <tbody></tbody>
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
                <tbody></tbody>
            </table>
        </div>
        <hr>
        <div class="section3-adjustments">
            <h4 class="section-title">Section 3: Adjustments</h4>
            <p class="input-caption">Add adjustment rows until Claimed = Actual</p>
            <table class="adjust-table">
                <thead><tr><th>#</th><th>Adjustment Type</th><th>From Purity</th><th>To Purity</th><th>Weight (g)</th><th>Notes / Remarks</th><th>Profit Impact</th><th>Delete</th></tr></thead>
                <tbody></tbody>
            </table>
            <button class="add-adjustment-btn btn-adjustment">+ Add Adjustment</button>
            <button class="save-adjustments-btn btn-save-green">Save All Adjustments</button>
        </div>
        <hr>
        <div class="recon-action-buttons">
            <button class="back-to-sale-btn btn-back">← Back to Sale Details</button>
            <button class="save-continue-btn btn-save-green">Save & Continue to Payments →</button>
        </div>
    `);

		// Call three section renders to fill tbody's
		this.renderReceiptSection();
		this.renderReconciliationSection();
		this.renderAdjustmentsSection();
	}

	renderReceiptSection() {
		const purities = this.availablePurities;

		// Helper to build options html
		const purityOptions = (selected) => {
			const blankOption = `<option value="" ${
				selected === "" ? "selected" : ""
			} disabled>Select</option>`;
			const otherOptions = purities
				.map(
					(p) => `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`
				)
				.join("");
			return blankOption + otherOptions;
		};

		const receiptLines = this.bagSummary
			.map(
				(r, idx) => `
            <tr data-idx="${idx}">
                <td><span class="move-arrows"><span class="up-arrow">&#9650;</span><span class="down-arrow">&#9660;</span></span></td>
             <td>
  <input list="purity-list-${idx}" class="input-purity" value="${r.purity}">
  <datalist id="purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                <td><input type="number" class="input-weight" value="${
					r.weight ? r.weight.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-rate" value="${
					r.rate ? r.rate.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-amount" value="${
					r.amount ? r.amount.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><button class="delete-row-btn" data-idx="${idx}">&#128465;</button></td>
            </tr>
        `
			)
			.join("");

		const receiptTable = this.container.find(
			".section1-buyer-receipt table.receipt-table tbody"
		);
		if (receiptTable.length) {
			receiptTable.html(`${receiptLines}
            <tr class="footer-total">
                <td colspan="2">TOTAL</td>
                <td class="total-weight">0.00 g</td>
                <td>-</td>
                <td class="total-amount">RM 0.00</td>
                <td></td>
            </tr>`);
		} else {
			// Initial render case - call full render to set HTML first
			this.render();
		}
	}

	renderReconciliationSection() {
		const reconRows = this.reconSummary
			.map(
				(r) => `
            <tr data-idx="${r.purity}" data-purity="${r.purity}">
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
            </tr>
        `
			)
			.join("");

		this.container.find(".section2-recon-summary table.recon-table tbody").html(reconRows);
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
		const section = this.container.find(".section3-adjustments");
		const tbody = section.find("tbody");
		tbody.empty();
		const purities = this.availablePurities; // get fresh purity list
		const addRow = () => {
			const idx = tbody.children().length + 1;
			const optionHTML = adjustmentOptions
				.map((o) => `<option value="${o}">${o}</option>`)
				.join("");

			const row = $(`
                <tr data-idx="${idx}">
                    <td>${idx}</td>
                    <td><select class="adjust-type">${optionHTML}</select></td>
                    <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                    <td><input type="number" class="weight" placeholder="0" /></td>
                    <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
                    <td class="profit-impact text-success">+RM 0.00</td>
                    <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
                </tr>
            `);
			tbody.append(row);
			// update the impact display for this freshly-added row
			this.computeProfitImpactForRow(tbody.find("tr").last());
		};

		section
			.find(".add-adjustment-btn")
			.off("click")
			.on("click", () => {
				const tbody = section.find("tbody");
				const idx = tbody.children().length + 1;
				const optionHTML = adjustmentOptions
					.map((o) => `<option value="${o}">${o}</option>`)
					.join("");
				const purities = this.availablePurities;
				const row = $(`
        <tr data-idx="${idx}">
            <td>${idx}</td>
            <td><select class="adjust-type">${optionHTML}</select></td>
          <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

            <td><input type="number" class="weight" placeholder="0" /></td>
            <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
            <td class="profit-impact text-success">+RM 0.00</td>
            <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
        </tr>
    `);
				tbody.append(row);
				this.bindAdjustmentEvents();
				this.updateReconciliationSummary();
			});

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
				tbody.find("tr").each((_, tr) => {
					const row = $(tr);
					adjustments.push({
						type: row.find(".adjust-type").val(),
						from_purity: row.find(".from-purity").val(),
						to_purity: row.find(".to-purity").val(),
						weight: row.find(".weight").val(),
						notes: row.find(".notes").val(),
						impact: row.find(".profit-impact").text(),
					});
				});

				this.adjustments = adjustments;

				const hasPurityBlend = adjustments.some(
					(adj) => adj.type === "Purity Blend (Melting)"
				);

				if (!this.isFullyReconciled() && !hasPurityBlend) {
					frappe.msgprint({
						title: "Reconciliation Incomplete",
						message:
							"Please complete reconciliation (Δ = 0) for all purities before saving.",
						indicator: "orange",
					});
					return;
				}

				this.onClickSaveAdjustments();

				frappe.show_alert({
					message: hasPurityBlend
						? "Adjustments saved (Purity Blend entries will be handled separately)."
						: "Adjustments saved successfully.",
					indicator: "green",
				});
			});

		addRow();

		// After "addRow();" and after setting up existing handlers:

		// Handler for ANY adjustment value changes (type, from_purity, weight)
		// canonical single handler for adjustment input changes
		tbody.off("input.adjust-update").on("input.adjust-update", "input,select", () => {
			// Recompute per-row profit impact and sync adjustments array
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const $tr = $(tr);
				// compute numeric impact and update cell
				const numericImpact = this.computeProfitImpactForRow($tr);

				this.adjustments.push({
					type: $tr.find(".adjust-type").val(),
					from_purity: $tr.find(".from-purity").val(),
					to_purity: $tr.find(".to-purity").val(),
					weight: $tr.find(".weight").val(),
					notes: $tr.find(".notes").val(),
					impact: numericImpact, // store numeric impact for persistence
				});
			});
			// Refresh reconciliation summary to apply aggregated impacts
			this.updateReconciliationSummary();
		});

		// Function to toggle visibility of 'To Purity' field in a given row based on selected adjustment type
		const toggleToPurityField = (row) => {
			const adjustmentType = row.find(".adjust-type").val();
			const toPurityInput = row.find(".to-purity");
			const fromPurityInput = row.find(".from-purity");
			if (adjustmentType === "Item Return") {
				toPurityInput.val("").hide().prop("readonly", false);
			} else if (
				adjustmentType === "Weight Loss - Torching/Cleaning" ||
				adjustmentType === "Weight Loss - Other" ||
				adjustmentType === "Weight Adjustment - Stones"
			) {
				toPurityInput.show().prop("readonly", true);
				toPurityInput.val(fromPurityInput.val());
			} else {
				toPurityInput.show().prop("readonly", false);
			}
		};

		// Initial toggle on all existing rows
		tbody.find("tr").each((_, tr) => {
			toggleToPurityField($(tr));
		});

		// Event handler for change on adjustment type select dropdown
		tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
			const row = $(e.currentTarget).closest("tr");
			toggleToPurityField(row);
			// Same as above: refresh adjustments and update recon
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const row = $(tr);
				this.adjustments.push({
					type: row.find(".adjust-type").val(),
					from_purity: row.find(".from-purity").val(),
					to_purity: row.find(".to-purity").val(),
					weight: row.find(".weight").val(),
					notes: row.find(".notes").val(),
					impact: row.find(".profit-impact").text(),
				});
			});
			this.updateReconciliationSummary();
		});

		// Real-time sync from_purity to to_purity for weight loss rows
		tbody.on("input", ".from-purity", function () {
			const row = $(this).closest("tr");
			const adjustmentType = row.find(".adjust-type").val();
			if (
				adjustmentType === "Weight Loss - Torching/Cleaning" ||
				adjustmentType === "Weight Loss - Other" ||
				adjustmentType === "Weight Adjustment - Stones"
			) {
				row.find(".to-purity").val($(this).val());
			}
		});
	}

	attachNavHandlers() {
		this.container.find(".back-to-sale-btn").on("click", this.backCallback);
		container
			.find(".save-continue-btn")
			.off("click")
			.on("click", async () => {
				try {
					await this.callCreateSalesAndDeliveryAPI();
					frappe.show_alert({
						message: "Sales and Delivery created successfully",
						indicator: "green",
					});
					if (this.continueCallback) this.continueCallback();
				} catch (error) {
					frappe.msgprint({
						title: "Error",
						message: `Failed to create sales and delivery: ${error.message}`,
						indicator: "red",
					});
				}
			});
	}

	bindReceiptEvents() {
		const container = this.container;

		container
			.find(".add-receipt-line-btn")
			.off("click")
			.on("click", () => {
				const newRow = {
					purity: "",
					weight: 0,
					rate: 0,
					amount: 0,
				};
				this.bagSummary.push(newRow);
				this.renderReceiptSection();
				this.bindReceiptEvents(); // Re-bind receipt events
				this.updateReconciliationSummary();
			});

		container.on("click", ".delete-row-btn", (e) => {
			const idx = $(e.currentTarget).data("idx");
			this.bagSummary.splice(idx, 1); // Remove from data array

			$(e.currentTarget).closest("tr").remove();

			this.renderReceiptSection();
			this.bindReceiptEvents();
			this.updateReconciliationSummary();
		});

		// Purity field event handler
		container.on("input", ".input-purity", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.data("idx");
			this.bagSummary[idx].purity = $(e.currentTarget).val();
		});

		container.find(".input-weight, .input-rate, .input-amount").on("blur", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.index();

			let weight = parseFloat(row.find(".input-weight").val()) || 0;
			let rate = parseFloat(row.find(".input-rate").val()) || 0;
			let amount = parseFloat(row.find(".input-amount").val()) || 0;
			const inputClass = $(e.currentTarget).attr("class");

			if (inputClass.includes("input-weight") && !inputClass.includes("input-amount")) {
				if (rate > 0) {
					amount = weight * rate;
				} else if (amount > 0 && weight > 0) {
					rate = amount / weight;
				} else {
					amount = 0;
					rate = 0;
				}
			} else if (inputClass.includes("input-rate") && !inputClass.includes("input-amount")) {
				if (weight > 0) {
					amount = weight * rate;
				} else if (amount > 0 && rate > 0) {
					weight = amount / rate;
				} else {
					amount = 0;
					weight = 0;
				}
			} else if (inputClass.includes("input-amount")) {
				if (weight > 0) {
					rate = amount / weight;
				} else if (rate > 0) {
					weight = amount / rate;
				} else {
					weight = 0;
					rate = 0;
				}
			}

			// Format on blur: always to 2 decimals
			row.find(".input-weight").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});
			row.find(".input-rate").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});
			row.find(".input-amount").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});

			if (this.bagSummary[idx]) {
				this.bagSummary[idx].weight = weight;
				this.bagSummary[idx].rate = rate;
				this.bagSummary[idx].amount = amount;
			}

			let totalWeight = 0,
				totalAmount = 0;
			this.bagSummary.forEach((r) => {
				totalWeight += r.weight || 0;
				totalAmount += r.amount || 0;
			});

			container
				.find(".receipt-table .footer-total .total-weight")
				.text(`${totalWeight.toFixed(2)} g`);
			container
				.find(".receipt-table .footer-total .total-amount")
				.text(`RM ${totalAmount.toFixed(2)}`);
			this.updateReconciliationSummary();
		});

		container.find(".input-weight, .input-amount").on("input", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.index();

			let weight = parseFloat(row.find(".input-weight").val()) || 0;
			let amount = parseFloat(row.find(".input-amount").val()) || 0;

			if (weight > 0 && amount > 0) {
				const rate = amount / weight;
				row.find(".input-rate").val(rate.toFixed(2));
				if (this.bagSummary[idx]) {
					this.bagSummary[idx].rate = rate;
				}
			} else {
				row.find(".input-rate").val("0.00");
				if (this.bagSummary[idx]) {
					this.bagSummary[idx].rate = 0;
				}
			}
		});

		container.on("input", ".input-weight, .input-amount", () => {
			let totalWeight = 0,
				totalAmount = 0;
			container.find(".receipt-table tbody tr").each(function () {
				const weight = parseFloat($(this).find(".input-weight").val()) || 0;
				const amount = parseFloat($(this).find(".input-amount").val()) || 0;
				totalWeight += weight;
				totalAmount += amount;
			});

			container
				.find(".receipt-table .footer-total .total-weight")
				.text(`${totalWeight.toFixed(2)} g`);
			container
				.find(".receipt-table .footer-total .total-amount")
				.text(`RM ${totalAmount.toFixed(2)}`);
		});

		container
			.find(".up-arrow, .down-arrow")
			.off("click")
			.on("click", (e) => {
				const isUp = $(e.currentTarget).hasClass("up-arrow");
				const row = $(e.currentTarget).closest("tr");
				if (isUp) {
					const prevRow = row.prev("tr");
					if (prevRow.length && !prevRow.hasClass("footer-total")) {
						row.insertBefore(prevRow);
					}
				} else {
					const nextRow = row.next("tr");
					if (nextRow.length && !nextRow.hasClass("footer-total")) {
						row.insertAfter(nextRow);
					}
				}
				const updatedSummary = [];
				container.find(".receipt-table tbody tr[data-idx]").each((i, tr) => {
					const idx = $(tr).data("idx");
					if (this.bagSummary[idx]) {
						updatedSummary.push(this.bagSummary[idx]);
					}
				});
				this.bagSummary = updatedSummary;
			});

		container
			.find(".save-continue-btn")
			.off("click")
			.on("click", async () => {
				const adjustments = this.adjustments || [];

				const hasPurityBlend = adjustments.some(
					(adj) => adj.type === "Purity Blend (Melting)"
				);

				if (!this.isFullyReconciled() && !hasPurityBlend) {
					frappe.msgprint({
						title: "Reconciliation Incomplete",
						message:
							"Please complete reconciliation (Δ = 0) for all purities before continuing to payments.",
						indicator: "orange",
					});
					return;
				}

				try {
					if (hasPurityBlend) {
						await this.callCreateMaterialReceiptAPI();
					}

					await this.callCreateSalesAndDeliveryAPI();

					frappe.show_alert({
						message: hasPurityBlend
							? "Sales, Delivery, and Material Receipt created successfully."
							: "Sales and Delivery created successfully.",
						indicator: "green",
					});

					if (this.continueCallback) this.continueCallback();
				} catch (error) {
					frappe.msgprint({
						title: "Error",
						message: `Failed to complete Save & Continue: ${error.message}`,
						indicator: "red",
					});
				}
			});
	}

	updateReconciliationSummary() {
		const container = this.container;

		// Precompute adjustment weight maps by type (per purity)
		const itemReturnMap = {};
		const weightLossMap = {};
		const weightAdjustStonesMap = {};
		const purityChangeOutMap = {}; // weights moved out from a purity
		const purityChangeInMap = {}; // weights moved into a purity

		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			const from = (adj.from_purity || "").trim();
			const to = (adj.to_purity || "").trim();
			const wt = parseFloat(adj.weight) || 0;

			if (!wt) return;

			if (type === "Item Return") {
				itemReturnMap[from] = (itemReturnMap[from] || 0) + wt;
			} else if (
				type === "Weight Loss - Torching/Cleaning" ||
				type === "Weight Loss - Other"
			) {
				weightLossMap[from] = (weightLossMap[from] || 0) + wt;
			} else if (type === "Weight Adjustment - Stones") {
				weightAdjustStonesMap[from] = (weightAdjustStonesMap[from] || 0) + wt;
			} else if (type === "Purity Change" || type === "Purity Blend (Melting)") {
				// For purity change, treat as moving wt from 'from' to 'to'
				purityChangeOutMap[from] = (purityChangeOutMap[from] || 0) + wt;
				purityChangeInMap[to] = (purityChangeInMap[to] || 0) + wt;
			}
		});

		// Build aggregated monetary impacts per purity (consistent with computeProfitImpactForRow)
		const adjustmentImpactMap = {}; // numeric RM adjustments per purity
		const { unit_revenue: __ur, unit_cost: __uc } = this.computeUnitMaps
			? this.computeUnitMaps()
			: { unit_revenue: {}, unit_cost: {} };

		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			const from = (adj.from_purity || "").trim();
			const to = (adj.to_purity || "").trim();
			const wt = parseFloat(adj.weight) || 0;
			if (!wt) return;

			const urFrom = (__ur && __ur[from]) || 0;
			const ucFrom = (__uc && __uc[from]) || 0;
			const urTo = (__ur && __ur[to]) || 0;
			const ucTo = (__uc && __uc[to]) || 0;

			let impactFrom = 0;
			let impactTo = 0;

			if (type === "Item Return") {
				impactFrom = -(urFrom - ucFrom) * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (
				type === "Weight Loss - Torching/Cleaning" ||
				type === "Weight Loss - Other"
			) {
				impactFrom = -urFrom * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (type === "Weight Adjustment - Stones") {
				impactFrom = (urFrom - ucFrom) * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (type === "Purity Change" || type === "Purity Blend (Melting)") {
				// margin difference moved from => to
				const margin_from = urFrom - ucFrom;
				const margin_to = urTo - ucTo;
				const net = (margin_to - margin_from) * wt;
				// net is positive if moving increases overall margin, negative otherwise.
				// Allocate negative impact on 'from' and positive on 'to'
				impactFrom = -net; // remove margin from 'from' (show as negative)
				impactTo = net; // add margin to 'to'
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
				adjustmentImpactMap[to] = (adjustmentImpactMap[to] || 0) + impactTo;
			}
		});

		// Iterate receipt rows and update reconciliation table rows
		const rows = container.find(".receipt-table tbody tr[data-idx]");

		// For faster lookup, load recon rows by purity key
		const reconMap = {};
		container.find(".recon-table tbody tr[data-purity]").each((_, r) => {
			const $r = $(r);
			const p = ($r.data("purity") || "").toString().trim();
			if (p) reconMap[p] = $r;
		});

		// --- Ensure all 'to' purities from Purity Blend (Melting) exist in reconciliation table ---
		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			if (type === "Purity Blend (Melting)") {
				const fromPurity = (adj.from_purity || "").trim();
				const toPurity = (adj.to_purity || "").trim();
				const addedWeight = parseFloat(adj.weight) || 0;

				if (!toPurity || !addedWeight) return;

				// If this purity doesn't exist yet, create a new row
				if (!reconMap[toPurity]) {
					const $tableBody = container.find(".recon-table tbody");
					const newRow = $(`
				<tr data-purity="${toPurity}">
					<td class="purity-cell">${toPurity}</td>
					<td class="actual-cell">0.00</td>
					<td class="claimed-cell">0.00</td>
					<td class="delta-cell">0.00</td>
					<td class="status-cell"><span class="status-icon warning">&#9888;</span></td>
					<td class="cost-basis">0.00</td>
					<td class="revenue-cell">RM 0.00</td>
					<td class="profit-cell">RM 0.00</td>
					<td class="profit-g-cell">RM 0.00</td>
					<td class="margin-cell">0.0%</td>
				</tr>
			`);
					$tableBody.append(newRow);
					reconMap[toPurity] = newRow;

					// 🔥 Copy cost basis and compute per-gram rate
					if (fromPurity && reconMap[fromPurity]) {
						const fromRow = reconMap[fromPurity];

						const fromCostBasis =
							parseFloat(
								fromRow
									.find(".cost-basis")
									.text()
									.replace(/[^\d.-]/g, "")
							) || 0;

						const fromClaimed =
							parseFloat(
								fromRow
									.find(".claimed-cell")
									.text()
									.replace(/[^\d.-]/g, "")
							) || 0;

						if (fromCostBasis > 0 && fromClaimed > 0) {
							const perGramRate = fromCostBasis / fromClaimed;
							const totalCost = perGramRate * addedWeight;

							newRow.find(".cost-basis").text(totalCost.toFixed(2));
							newRow.data("per-gram-rate", perGramRate); // store per-gram rate for later use

							console.log(
								`Copied cost basis ${fromCostBasis} from purity ${fromPurity} → ${toPurity}, per-gram rate ${perGramRate.toFixed(
									2
								)}`
							);
						} else {
							console.warn(
								`Source purity ${fromPurity} has 0 cost basis or 0 claimed weight.`
							);
						}
					} else {
						console.warn(`No valid source row found for from_purity ${fromPurity}.`);
					}
				}
			}
		});

		// We'll also update any recon rows that have no receipt row (e.g., a 'to' purity that only gets increased)
		// But first update based on receipt rows to get actual weights.
		rows.each((_, rowElem) => {
			const row = $(rowElem);
			const purityVal = (row.find(".input-purity").val() || "").toString().trim();
			const purity = purityVal || "";
			const weight = parseFloat(row.find(".input-weight").val()) || 0;
			const rate = parseFloat(row.find(".input-rate").val()) || 0;
			const amountInput = parseFloat(row.find(".input-amount").val());
			const amount = isNaN(amountInput) ? weight * rate : amountInput;

			if (!purity || !reconMap[purity]) return;

			const reconRow = reconMap[purity];
			let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;

			// Apply adjustments affecting this purity:
			const itemReturnWeight = itemReturnMap[purity] || 0;
			const weightLoss = weightLossMap[purity] || 0;
			const weightAdjustStones = weightAdjustStonesMap[purity] || 0;
			const purityOut = purityChangeOutMap[purity] || 0; // moved out
			const purityIn = purityChangeInMap[purity] || 0; // moved in

			// Effective claimed = baseClaimed - out (item return + purity out + weight loss) + in (purity in + stones adjust)
			const claimed =
				baseClaimed -
				itemReturnWeight -
				weightLoss -
				purityOut +
				purityIn +
				weightAdjustStones;

			// Show strikethrough -> new claimed when it changed
			if (Math.abs(claimed - baseClaimed) > 0.0009) {
				// If claimed decreased show original -> new, likewise for increase
				reconRow
					.find(".claimed-cell")
					.html(`<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`);
			} else {
				reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
			}

			// Actual is the physical weight in Section 1 for this row
			const actual = weight;
			const delta = (actual - claimed).toFixed(2);

			// Cost basis read from UI (existing behavior)
			const baseCostBasis =
				parseFloat(
					reconRow
						.find(".cost-basis")
						.text()
						.replace(/[^\d.-]/g, "")
				) || 0;

			// Compute revenue/profit,
			let revenue = 0,
				profit = 0,
				profitG = 0,
				margin = 0;
			let statusHTML = "";

			// When actual equals claimed and amount equals cost_basis (earlier logic)
			if (Math.abs(actual - claimed) < 0.001 && Math.abs(amount - baseCostBasis) < 0.001) {
				statusHTML = '<span class="status-icon success">&#10004;</span>';
				reconRow.addClass("recon-row-green");
			} else {
				revenue = amount;
				profit = revenue - baseCostBasis;

				// Apply aggregated adjustment impact for this purity (if any)
				const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
				profit += adjImpactForPurity;

				profitG = actual ? profit / actual : 0;
				margin = revenue ? (profit / revenue) * 100 : 0;

				const totalWeightAdjustments =
					itemReturnWeight + weightLoss + purityOut + weightAdjustStones - purityIn;
				// Adjust status logic conservatively: success if positive profit/g or revenue > cost (as before)
				if (
					(profit > 0 && totalWeightAdjustments > 0) ||
					profitG > 0 ||
					revenue > baseCostBasis
				) {
					statusHTML = '<span class="status-icon success">&#10004;</span>';
					reconRow.addClass("recon-row-green");
				} else {
					statusHTML = '<span class="status-icon warning">&#9888;</span>';
					reconRow.removeClass("recon-row-green");
				}
			}

			// Update reconciliation cells
			reconRow.find(".actual-cell").text(actual.toFixed(2));
			reconRow.find(".delta-cell").text(delta);
			reconRow
				.find(".revenue-cell")
				.text(`RM ${revenue.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow
				.find(".profit-cell")
				.text(`RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow
				.find(".profit-g-cell")
				.text(`RM ${profitG.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
			reconRow.find(".status-cell").html(statusHTML);
		});

		// Additionally, update recon rows that are present in reconciliation table but not linked to a receipt row:
		// (these might be pure 'to' purities that just got increased)
		Object.keys(reconMap).forEach((purity) => {
			// if there is no receipt-row with this purity, still update the claimed to reflect purityChangeInMap
			const reconRow = reconMap[purity];
			const hasReceiptRow = !!container
				.find(`.receipt-table tbody tr[data-idx] .input-purity`)
				.filter(function () {
					return ($(this).val() || "").trim() === purity;
				}).length;

			if (!hasReceiptRow) {
				let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;

				const purityIn = purityChangeInMap[purity] || 0;
				const purityOut = purityChangeOutMap[purity] || 0;
				const itemReturnWeight = itemReturnMap[purity] || 0;
				const weightLoss = weightLossMap[purity] || 0;
				const weightAdjustStones = weightAdjustStonesMap[purity] || 0;

				const claimed =
					baseClaimed -
					itemReturnWeight -
					weightLoss -
					purityOut +
					purityIn +
					weightAdjustStones;

				if (Math.abs(claimed - baseClaimed) > 0.0009) {
					reconRow
						.find(".claimed-cell")
						.html(`<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`);
				} else {
					reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
				}

				// For these, actual remains whatever existing value is (likely 0), so just update claimed and impacts
				const actual = parseFloat(reconRow.find(".actual-cell").text()) || 0;
				const delta = (actual - claimed).toFixed(2);

				let baseCostBasis =
					parseFloat(
						reconRow
							.find(".cost-basis")
							.text()
							.replace(/[^\d.-]/g, "")
					) || 0;

				let revenue = 0,
					profit = 0,
					profitG = 0,
					margin = 0;
				let statusHTML = "";

				const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
				profit = revenue - baseCostBasis + adjImpactForPurity;
				profitG = actual ? profit / actual : 0;
				margin = revenue ? (profit / revenue) * 100 : 0;

				if (profit > 0 || profitG > 0) {
					statusHTML = '<span class="status-icon success">&#10004;</span>';
					reconRow.addClass("recon-row-green");
				} else {
					statusHTML = '<span class="status-icon warning">&#9888;</span>';
					reconRow.removeClass("recon-row-green");
				}

				reconRow.find(".delta-cell").text(delta);
				reconRow
					.find(".profit-cell")
					.text(`RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
				reconRow
					.find(".profit-g-cell")
					.text(`RM ${profitG.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
				reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
				reconRow.find(".status-cell").html(statusHTML);
			}
		});
	}

	bindAdjustmentEvents() {
		const tbody = this.container.find(".section3-adjustments tbody");

		tbody.off("click", ".btn-delete-row").on("click", ".btn-delete-row", (e) => {
			$(e.currentTarget).closest("tr").remove();
			tbody.find("tr").each((i, tr) => {
				$(tr)
					.find("td:first")
					.text(i + 1);
			});
			this.updateReconciliationSummary();
		});

		tbody.off("input.adjust-update").on("input.adjust-update", "input,select", () => {
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const row = $(tr);
				this.adjustments.push({
					type: row.find(".adjust-type").val(),
					from_purity: row.find(".from-purity").val(),
					to_purity: row.find(".to-purity").val(),
					weight: row.find(".weight").val(),
					notes: row.find(".notes").val(),
					impact: row.find(".profit-impact").text(),
				});
			});
			this.updateReconciliationSummary();
		});

		tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
			const row = $(e.currentTarget).closest("tr");
			this.toggleToPurityField(row);
			this.updateReconciliationSummary();
		});

		tbody.off("input", ".from-purity").on("input", ".from-purity", function () {
			const row = $(this).closest("tr");
			const adjustmentType = row.find(".adjust-type").val();
			if (
				[
					"Weight Loss - Torching/Cleaning",
					"Weight Loss - Other",
					"Weight Adjustment - Stones",
				].includes(adjustmentType)
			) {
				row.find(".to-purity").val($(this).val());
			}
		});
	}

	isFullyReconciled() {
		let reconciled = true;
		this.container.find(".recon-table tbody tr").each((_, tr) => {
			const delta = parseFloat($(tr).find(".delta-cell").text());
			const isGreen = $(tr).hasClass("recon-row-green");
			if (Math.abs(delta) > 0.001 || !isGreen) {
				reconciled = false;
				return false; // exit loop early if any row fails
			}
		});
		return reconciled;
	}

	async callCreateSalesAndDeliveryAPI() {
		if (!this.props.customer) {
			throw new Error("Customer info missing.");
		}

		const warehouse = this.props.selected_bag + " - AGSB";
		const items = this.bagSummary.map((line) => {
			const purityStr = line.purity || "";
			return {
				item_code: `Unsorted-${purityStr}`,
				purity: purityStr,
				weight: parseFloat(line.weight) || 0,
				rate: parseFloat(line.rate) || 0,
				warehouse: warehouse,
			};
		});

		const payload = {
			customer: this.props.customer,
			items: JSON.stringify(items),
			company: this.props.company || null,
		};

		await new Promise((resolve, reject) => {
			frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.create_sales_invoice",
				args: payload,
				callback: (r) => {
					console.log("API response:", r);
					if (r.message && r.message.status === "success") {
						resolve(r.message);
					} else {
						reject(new Error("API returned failure"));
					}
				},
				errorHandler: (err) => {
					console.error("API call error:", err);
					reject(err);
				},
			});
		});
	}

	async callCreateMaterialReceiptAPI() {
		try {
			// Collect Purity Blend (Melting) items
			const items = [];
			(this.adjustments || []).forEach((adj) => {
				const type = adj.type;
				if (type === "Purity Blend (Melting)") {
					const toPurity = (adj.to_purity || "").trim();
					const addedWeight = parseFloat(adj.weight) || 0;

					if (!toPurity || !addedWeight) return;

					// Get cost basis and actual weight for this purity
					const row = this.container.find(`.recon-table tr[data-purity='${toPurity}']`);
					const costBasis = parseFloat(row.find(".cost-basis").text()) || 0;
					const actualWeight = parseFloat(row.find(".actual-cell").text()) || 0;

					// Try getting pre-stored per-gram rate
					let basicRate = parseFloat(row.data("per-gram-rate")) || 0;

					// If not found, fallback calculation
					if (!basicRate && actualWeight > 0) {
						basicRate = costBasis / actualWeight;
					}

					items.push({
						purity: toPurity,
						qty: addedWeight,
						basic_rate: basicRate,
					});
				}
			});

			console.log("Material Receipt Items:", items);

			if (items.length === 0) {
				console.log("No Purity Blend items found to create stock entry.");
				return;
			}

			// Call backend API to create Stock Entry
			await frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.create_material_receipt",
				args: { items },
				freeze: true,
				freeze_message: "Creating Material Receipt...",
				callback: (r) => {
					if (r.message) {
						frappe.show_alert({
							message: `Stock Entry Created: ${r.message.stock_entry_name}`,
							indicator: "green",
						});
					}
				},
			});
		} catch (error) {
			console.error("Error creating Material Receipt:", error);
			frappe.msgprint({
				title: "Error",
				message: `Failed to create Material Receipt: ${error.message}`,
				indicator: "red",
			});
		}
	}

	bindUploadReceipt() {
		const container = this.container;
		if (container.find("#hidden-upload-input").length === 0) {
			const fileInput = $(
				'<input type="file" id="hidden-upload-input" style="display:none" />'
			);
			container.append(fileInput);
			fileInput.on("change", (e) => {
				const file = e.target.files[0];
				if (!file) return;
				this.pendingReceiptFile = file; // Save the file object for later
				frappe.show_alert({
					message: `Receipt "${file.name}" selected, will be uploaded on Save.`,
					indicator: "green",
				});
			});
		}
		container
			.find(".btn-upload-receipt")
			.off("click")
			.on("click", () => {
				container.find("#hidden-upload-input").click();
			});
	}

	uploadReceiptFile(transactionName) {
		if (!this.pendingReceiptFile) return;
		const file = this.pendingReceiptFile;
		const reader = new FileReader();
		reader.onload = (ev) => {
			frappe.call({
				method: "frappe.client.attach_file",
				args: {
					doctype: "Wholesale Transaction",
					docname: transactionName, // now the valid docname!
					filedata: ev.target.result.split(",")[1],
					filename: file.name,
					is_private: 1,
				},
				callback: (r) => {
					if (r.message && r.message.file_url) {
						// Update the transaction's upload_receipt field after attaching
						frappe.call({
							method: "frappe.client.set_value",
							args: {
								doctype: "Wholesale Transaction",
								name: transactionName,
								fieldname: "upload_receipt",
								value: r.message.file_url,
							},
							callback: () => {
								frappe.show_alert({
									message: "Receipt file linked successfully!",
									indicator: "green",
								});
							},
						});
					}
				},
			});
		};
		reader.readAsDataURL(file);
	}

	onClickSaveAdjustments() {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Wholesale Transaction",
				filters: { wholesale_bag: this.props.selected_bag },
				fields: ["name"],
			},
			callback: (res) => {
				let transactionDoc = {
					doctype: "Wholesale Transaction",
					wholesale_bag: this.props.selected_bag,
					buyer: this.props.customer,
					buyer_name: this.props.buyer_name || "",
					sale_date: this.props.sale_date,
					total_cost_basis: this.props.totalAmount,
					receipt_lines: this.bagSummary.map((line) => ({
						purity: line.purity,
						weight: line.weight,
						rate: line.rate,
						amount: line.amount,
					})),
					reconciliation_lines: [],
					adjustments: this.adjustments.map((adj) => ({
						adjustment_type: adj.type,
						from_purity: adj.from_purity,
						to_purity: adj.to_purity,
						weight: adj.weight,
						notes: adj.notes,
						profit_impact: adj.impact,
					})),
				};

				this.container.find(".recon-table tbody tr").each((_, tr) => {
					const $tr = $(tr);
					transactionDoc.reconciliation_lines.push({
						purity: $tr.find("td:eq(0)").text().trim(),
						actual: parseFloat($tr.find(".actual-cell").text()) || 0,
						claimed: parseFloat($tr.find(".claimed-cell").text()) || 0,
						delta: parseFloat($tr.find(".delta-cell").text()) || 0,
						status: $tr.find(".status-cell").text().trim() || "",
						cost_basis:
							parseFloat(
								$tr
									.find(".cost-basis")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						revenue:
							parseFloat(
								$tr
									.find(".revenue-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						profit:
							parseFloat(
								$tr
									.find(".profit-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						profit_g:
							parseFloat(
								$tr
									.find(".profit-g-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						margin_percent: parseFloat($tr.find(".margin-cell").text()) || 0,
					});
				});

				// 1. Transaction exists: update, then upload
				if (res.message && res.message.length > 0) {
					const docname = res.message[0].name;

					frappe.call({
						method: "frappe.client.get",
						args: { doctype: "Wholesale Transaction", name: docname },
						callback: (r) => {
							if (r.message) {
								Object.assign(r.message, transactionDoc);
								frappe.call({
									method: "frappe.client.save",
									args: { doc: r.message },
									callback: (saveRes) => {
										frappe.show_alert({
											message: "Transaction updated successfully.",
											indicator: "green",
										});
										this.uploadReceiptFile(docname); // <- Always use docname!
									},
									error: (e) => {
										frappe.msgprint("Update failed: " + (e.message || e));
									},
								});
							}
						},
						error: (e) => {
							frappe.msgprint("Failed to fetch latest doc: " + (e.message || e));
						},
					});
				} else {
					// 2. New transaction: insert, then upload receipt
					frappe.call({
						method: "frappe.client.insert",
						args: { doc: transactionDoc },
						callback: (insertRes) => {
							frappe.show_alert({
								message: "Transaction saved successfully.",
								indicator: "green",
							});
							if (insertRes.message && insertRes.message.name) {
								this.uploadReceiptFile(insertRes.message.name); // <- Use the REAL docname!
							}
						},
						error: (e) => {
							frappe.msgprint("Save failed: " + (e.message || e));
						},
					});
				}
			},
			error: (e) => {
				frappe.msgprint("Error searching for transaction: " + (e.message || e));
			},
		});
	}

	// Prfit Impact
	computeUnitMaps() {
		const unit_revenue = {};
		const unit_cost = {};

		// Build unit_revenue from receipt-table rows
		this.container.find(".receipt-table tbody tr[data-idx]").each((_, tr) => {
			const $tr = $(tr);
			const purity = ($tr.find(".input-purity").val() || "").trim();
			const w = parseFloat($tr.find(".input-weight").val()) || 0;
			const a = parseFloat($tr.find(".input-amount").val()) || 0;
			if (purity && w > 0) {
				// If multiple rows for same purity, last one will overwrite; acceptable for simplicity.
				unit_revenue[purity] = a / w;
			}
		});

		// Build unit_cost from reconSummary (use DOM cost-basis cell as source of truth)
		this.container.find(".recon-table tbody tr[data-purity]").each((_, tr) => {
			const $tr = $(tr);
			const purity = $tr.data("purity");
			const claimed =
				parseFloat(
					$tr
						.find(".claimed-cell")
						.text()
						.replace(/[^\d.-]/g, "")
				) || 0;
			const costText = $tr
				.find(".cost-basis")
				.text()
				.replace(/[^\d.-]/g, "");
			const cost = parseFloat(costText) || 0;
			if (purity && claimed > 0) {
				unit_cost[purity] = cost / claimed;
			} else {
				unit_cost[purity] = 0;
			}
		});

		return { unit_revenue, unit_cost };
	}

	computeProfitImpactForRow($row) {
		const type = $row.find(".adjust-type").val();
		const from = ($row.find(".from-purity").val() || "").trim();
		const to = ($row.find(".to-purity").val() || "").trim();
		const weight = parseFloat($row.find(".weight").val()) || 0;

		const { unit_revenue, unit_cost } = this.computeUnitMaps();

		const getUR = (p) => unit_revenue[p] || 0;
		const getUC = (p) => unit_cost[p] || 0;

		let impact = 0;

		switch (type) {
			case "Item Return":
				// Profit lost = gross margin per g * weight
				impact = -(getUR(from) - getUC(from)) * weight;
				break;
			case "Weight Loss - Torching/Cleaning":
			case "Weight Loss - Other":
				// Revenue lost (conservative)
				impact = -getUR(from) * weight;
				break;
			case "Weight Adjustment - Stones":
				// Stones removal increases saleable weight → gains margin
				impact = (getUR(from) - getUC(from)) * weight;
				break;
			case "Purity Change":
			case "Purity Blend (Melting)":
				// Move from -> to: net change = (margin_to - margin_from) * weight
				const margin_to = getUR(to) - getUC(to);
				const margin_from = getUR(from) - getUC(from);
				impact = (margin_to - margin_from) * weight;
				break;
			default:
				impact = 0;
		}

		// Update UI cell text with sign and two decimals
		// --- Update UI cell styling and text based on sign ---
		const $impactCell = $row.find(".profit-impact");
		const sign = impact >= 0 ? "+" : "-";
		const absVal = Math.abs(impact).toFixed(2);
		$impactCell.text(`${sign}RM ${absVal}`);

		// Apply color classes
		if (impact >= 0) {
			$impactCell.removeClass("text-danger").addClass("text-success");
		} else {
			$impactCell.removeClass("text-success").addClass("text-danger");
		}

		// return signed numeric value
		return impact;
	}
}

// Version 1

class Step3TabReceiptReconciliation {
	constructor(
		props,
		container,
		backCallback,
		continueCallback,
		syncDataCallback,
		onSalesInvoiceCreated
	) {
		this.props = props;
		this.container = container;
		this.backCallback = backCallback;
		this.continueCallback = continueCallback;
		this.syncDataCallback = syncDataCallback;
		this.onSalesInvoiceCreated = onSalesInvoiceCreated;
		this.reconSummary = props.reconSummary.length
			? props.reconSummary
			: this.initializeReconSummary();
		this.adjustments = props.adjustments;
		this.bagSummary = [];
		this.uploadedReceiptUrl = "";
		this.availablePurities = [];

		this.fetchPuritiesFromDoctype().then((purities) => {
			this.availablePurities = purities;
			this.render();
			this.bindReceiptEvents();
			this.bindUploadReceipt();
			this.renderAdjustmentsSection();
			this.attachNavHandlers();
		});
	}

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

	renderAndBindAll() {
		this.render();
		this.bindReceiptEvents();
		this.bindUploadReceipt();
		this.renderAdjustmentsSection();
		this.attachNavHandlers();
		this.updateReconciliationSummary();
	}

	async fetchPuritiesFromDoctype() {
		try {
			const response = await frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Purity",
					fields: ["name"],
					limit_page_length: 100,
					order_by: "name asc",
				},
			});
			// Extract purity names from result
			return response.message.map((item) => item.name);
		} catch (error) {
			console.error("Error fetching purities:", error);
			return [];
		}
	}

	render() {
		this.container.html(`
        <div class="section1-buyer-receipt">
            <h4 class="section-title">Section 1: Buyer's Official Receipt</h4>
            <p class="input-caption">Enter what the buyer actually paid for</p>
            <table class="receipt-table">
                <thead><tr><th>Move</th><th>Purity</th><th>Weight (g) *</th><th>Rate (RM/g)</th><th>Amount (RM)</th><th>Action</th></tr></thead>
                <tbody></tbody>
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
                <tbody></tbody>
            </table>
        </div>
        <hr>
        <div class="section3-adjustments">
            <h4 class="section-title">Section 3: Adjustments</h4>
            <p class="input-caption">Add adjustment rows until Claimed = Actual</p>
            <table class="adjust-table">
                <thead><tr><th>#</th><th>Adjustment Type</th><th>From Purity</th><th>To Purity</th><th>Weight (g)</th><th>Notes / Remarks</th><th>Profit Impact</th><th>Delete</th></tr></thead>
                <tbody></tbody>
            </table>
            <button class="add-adjustment-btn btn-adjustment">+ Add Adjustment</button>
            <button class="save-adjustments-btn btn-save-green">Save All Adjustments</button>
        </div>
        <hr>
        <div class="recon-action-buttons">
            <button class="back-to-sale-btn btn-back">← Back to Sale Details</button>
            <button class="save-continue-btn btn-save-green">Save & Continue to Payments →</button>
        </div>
    `);

		// Call three section renders to fill tbody's
		this.renderReceiptSection();
		this.renderReconciliationSection();
		this.renderAdjustmentsSection();
	}

	renderReceiptSection() {
		const purities = this.availablePurities;

		// Helper to build options html
		const purityOptions = (selected) => {
			const blankOption = `<option value="" ${
				selected === "" ? "selected" : ""
			} disabled>Select</option>`;
			const otherOptions = purities
				.map(
					(p) => `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`
				)
				.join("");
			return blankOption + otherOptions;
		};

		const receiptLines = this.bagSummary
			.map(
				(r, idx) => `
            <tr data-idx="${idx}">
                <td><span class="move-arrows"><span class="up-arrow">&#9650;</span><span class="down-arrow">&#9660;</span></span></td>
             <td>
  <input list="purity-list-${idx}" class="input-purity" value="${r.purity}">
  <datalist id="purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                <td><input type="number" class="input-weight" value="${
					r.weight ? r.weight.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-rate" value="${
					r.rate ? r.rate.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-amount" value="${
					r.amount ? r.amount.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><button class="delete-row-btn" data-idx="${idx}">&#128465;</button></td>
            </tr>
        `
			)
			.join("");

		const receiptTable = this.container.find(
			".section1-buyer-receipt table.receipt-table tbody"
		);
		if (receiptTable.length) {
			receiptTable.html(`${receiptLines}
            <tr class="footer-total">
                <td colspan="2">TOTAL</td>
                <td class="total-weight">0.00 g</td>
                <td>-</td>
                <td class="total-amount">RM 0.00</td>
                <td></td>
            </tr>`);
		} else {
			// Initial render case - call full render to set HTML first
			this.render();
		}
	}

	renderReconciliationSection() {
		const reconRows = this.reconSummary
			.map(
				(r) => `
            <tr data-idx="${r.purity}" data-purity="${r.purity}">
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
            </tr>
        `
			)
			.join("");

		this.container.find(".section2-recon-summary table.recon-table tbody").html(reconRows);
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
		const section = this.container.find(".section3-adjustments");
		const tbody = section.find("tbody");
		tbody.empty();
		const purities = this.availablePurities; // get fresh purity list
		const addRow = () => {
			const idx = tbody.children().length + 1;
			const optionHTML = adjustmentOptions
				.map((o) => `<option value="${o}">${o}</option>`)
				.join("");

			const row = $(`
                <tr data-idx="${idx}">
                    <td>${idx}</td>
                    <td><select class="adjust-type">${optionHTML}</select></td>
                    <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                    <td><input type="number" class="weight" placeholder="0" /></td>
                    <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
                    <td class="profit-impact text-success">+RM 0.00</td>
                    <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
                </tr>
            `);
			tbody.append(row);
			// update the impact display for this freshly-added row
			this.computeProfitImpactForRow(tbody.find("tr").last());
		};

		section
			.find(".add-adjustment-btn")
			.off("click")
			.on("click", () => {
				const tbody = section.find("tbody");
				const idx = tbody.children().length + 1;
				const optionHTML = adjustmentOptions
					.map((o) => `<option value="${o}">${o}</option>`)
					.join("");
				const purities = this.availablePurities;
				const row = $(`
        <tr data-idx="${idx}">
            <td>${idx}</td>
            <td><select class="adjust-type">${optionHTML}</select></td>
          <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

            <td><input type="number" class="weight" placeholder="0" /></td>
            <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
            <td class="profit-impact text-success">+RM 0.00</td>
            <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
        </tr>
    `);
				tbody.append(row);
				this.bindAdjustmentEvents();
				this.updateReconciliationSummary();
			});

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
				tbody.find("tr").each((_, tr) => {
					const row = $(tr);
					adjustments.push({
						type: row.find(".adjust-type").val(),
						from_purity: row.find(".from-purity").val(),
						to_purity: row.find(".to-purity").val(),
						weight: row.find(".weight").val(),
						notes: row.find(".notes").val(),
						impact: row.find(".profit-impact").text(),
					});
				});

				this.adjustments = adjustments;

				const hasPurityBlend = adjustments.some(
					(adj) => adj.type === "Purity Blend (Melting)"
				);

				if (!this.isFullyReconciled() && !hasPurityBlend) {
					frappe.msgprint({
						title: "Reconciliation Incomplete",
						message:
							"Please complete reconciliation (Δ = 0) for all purities before saving.",
						indicator: "orange",
					});
					return;
				}

				this.onClickSaveAdjustments();

				frappe.show_alert({
					message: hasPurityBlend
						? "Adjustments saved (Purity Blend entries will be handled separately)."
						: "Adjustments saved successfully.",
					indicator: "green",
				});
			});

		addRow();

		// After "addRow();" and after setting up existing handlers:

		// Handler for ANY adjustment value changes (type, from_purity, weight)
		// canonical single handler for adjustment input changes
		tbody.off("input.adjust-update").on("input.adjust-update", "input,select", (e) => {
			const $changedRow = $(e.currentTarget).closest("tr");
			// Compute impact only for changed row
			this.computeProfitImpactForRow($changedRow);

			// Update adjustments array fully after change
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const $tr = $(tr);
				this.adjustments.push({
					type: $tr.find(".adjust-type").val(),
					from_purity: $tr.find(".from-purity").val(),
					to_purity: $tr.find(".to-purity").val(),
					weight: $tr.find(".weight").val(),
					notes: $tr.find(".notes").val(),
					impact: $tr.find(".profit-impact").text(),
				});
			});

			// Update reconciliation summary
			this.updateReconciliationSummary();
		});

		// Function to toggle visibility of 'To Purity' field in a given row based on selected adjustment type
		const toggleToPurityField = (row) => {
			const adjustmentType = row.find(".adjust-type").val();
			const toPurityInput = row.find(".to-purity");
			const fromPurityInput = row.find(".from-purity");
			if (adjustmentType === "Item Return") {
				toPurityInput.val("").hide().prop("readonly", false);
			} else if (
				adjustmentType === "Weight Loss - Torching/Cleaning" ||
				adjustmentType === "Weight Loss - Other" ||
				adjustmentType === "Weight Adjustment - Stones"
			) {
				toPurityInput.show().prop("readonly", true);
				toPurityInput.val(fromPurityInput.val());
			} else {
				toPurityInput.show().prop("readonly", false);
			}
		};

		// Initial toggle on all existing rows
		tbody.find("tr").each((_, tr) => {
			toggleToPurityField($(tr));
		});

		// Event handler for change on adjustment type select dropdown
		tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
			const row = $(e.currentTarget).closest("tr");
			toggleToPurityField(row);
			// Same as above: refresh adjustments and update recon
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const row = $(tr);
				this.adjustments.push({
					type: row.find(".adjust-type").val(),
					from_purity: row.find(".from-purity").val(),
					to_purity: row.find(".to-purity").val(),
					weight: row.find(".weight").val(),
					notes: row.find(".notes").val(),
					impact: row.find(".profit-impact").text(),
				});
			});
			this.updateReconciliationSummary();
		});

		// Real-time sync from_purity to to_purity for weight loss rows
		tbody.on("input", ".from-purity", function () {
			const row = $(this).closest("tr");
			const adjustmentType = row.find(".adjust-type").val();
			if (
				adjustmentType === "Weight Loss - Torching/Cleaning" ||
				adjustmentType === "Weight Loss - Other" ||
				adjustmentType === "Weight Adjustment - Stones"
			) {
				row.find(".to-purity").val($(this).val());
			}
		});
	}

	attachNavHandlers() {
		this.container.find(".back-to-sale-btn").on("click", this.backCallback);
		container
			.find(".save-continue-btn")
			.off("click")
			.on("click", async () => {
				try {
					await this.callCreateSalesAndDeliveryAPI();
					frappe.show_alert({
						message: "Sales and Delivery created successfully",
						indicator: "green",
					});
					if (this.continueCallback) this.continueCallback();
				} catch (error) {
					frappe.msgprint({
						title: "Error",
						message: `Failed to create sales and delivery: ${error.message}`,
						indicator: "red",
					});
				}
			});
	}

	bindReceiptEvents() {
		const container = this.container;

		container
			.find(".add-receipt-line-btn")
			.off("click")
			.on("click", () => {
				const newRow = {
					purity: "",
					weight: 0,
					rate: 0,
					amount: 0,
				};
				this.bagSummary.push(newRow);
				this.renderReceiptSection();
				this.bindReceiptEvents(); // Re-bind receipt events
				this.updateReconciliationSummary();
			});

		container.on("click", ".delete-row-btn", (e) => {
			const idx = $(e.currentTarget).data("idx");
			this.bagSummary.splice(idx, 1); // Remove from data array

			$(e.currentTarget).closest("tr").remove();

			this.renderReceiptSection();
			this.bindReceiptEvents();
			this.updateReconciliationSummary();
		});

		// Purity field event handler
		container.on("input", ".input-purity", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.data("idx");
			this.bagSummary[idx].purity = $(e.currentTarget).val();
		});

		container.find(".input-weight, .input-rate, .input-amount").on("blur", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.index();

			let weight = parseFloat(row.find(".input-weight").val()) || 0;
			let rate = parseFloat(row.find(".input-rate").val()) || 0;
			let amount = parseFloat(row.find(".input-amount").val()) || 0;
			const inputClass = $(e.currentTarget).attr("class");

			if (inputClass.includes("input-weight") && !inputClass.includes("input-amount")) {
				if (rate > 0) {
					amount = weight * rate;
				} else if (amount > 0 && weight > 0) {
					rate = amount / weight;
				} else {
					amount = 0;
					rate = 0;
				}
			} else if (inputClass.includes("input-rate") && !inputClass.includes("input-amount")) {
				if (weight > 0) {
					amount = weight * rate;
				} else if (amount > 0 && rate > 0) {
					weight = amount / rate;
				} else {
					amount = 0;
					weight = 0;
				}
			} else if (inputClass.includes("input-amount")) {
				if (weight > 0) {
					rate = amount / weight;
				} else if (rate > 0) {
					weight = amount / rate;
				} else {
					weight = 0;
					rate = 0;
				}
			}

			// Format on blur: always to 2 decimals
			row.find(".input-weight").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});
			row.find(".input-rate").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});
			row.find(".input-amount").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});

			if (this.bagSummary[idx]) {
				this.bagSummary[idx].weight = weight;
				this.bagSummary[idx].rate = rate;
				this.bagSummary[idx].amount = amount;
			}

			let totalWeight = 0,
				totalAmount = 0;
			this.bagSummary.forEach((r) => {
				totalWeight += r.weight || 0;
				totalAmount += r.amount || 0;
			});

			container
				.find(".receipt-table .footer-total .total-weight")
				.text(`${totalWeight.toFixed(2)} g`);
			container
				.find(".receipt-table .footer-total .total-amount")
				.text(`RM ${totalAmount.toFixed(2)}`);
			this.updateReconciliationSummary();
		});

		container.find(".input-weight, .input-amount").on("input", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.index();

			let weight = parseFloat(row.find(".input-weight").val()) || 0;
			let amount = parseFloat(row.find(".input-amount").val()) || 0;

			if (weight > 0 && amount > 0) {
				const rate = amount / weight;
				row.find(".input-rate").val(rate.toFixed(2));
				if (this.bagSummary[idx]) {
					this.bagSummary[idx].rate = rate;
				}
			} else {
				row.find(".input-rate").val("0.00");
				if (this.bagSummary[idx]) {
					this.bagSummary[idx].rate = 0;
				}
			}
		});

		container.on("input", ".input-weight, .input-amount", () => {
			let totalWeight = 0,
				totalAmount = 0;
			container.find(".receipt-table tbody tr").each(function () {
				const weight = parseFloat($(this).find(".input-weight").val()) || 0;
				const amount = parseFloat($(this).find(".input-amount").val()) || 0;
				totalWeight += weight;
				totalAmount += amount;
			});

			container
				.find(".receipt-table .footer-total .total-weight")
				.text(`${totalWeight.toFixed(2)} g`);
			container
				.find(".receipt-table .footer-total .total-amount")
				.text(`RM ${totalAmount.toFixed(2)}`);
		});

		container
			.find(".up-arrow, .down-arrow")
			.off("click")
			.on("click", (e) => {
				const isUp = $(e.currentTarget).hasClass("up-arrow");
				const row = $(e.currentTarget).closest("tr");
				if (isUp) {
					const prevRow = row.prev("tr");
					if (prevRow.length && !prevRow.hasClass("footer-total")) {
						row.insertBefore(prevRow);
					}
				} else {
					const nextRow = row.next("tr");
					if (nextRow.length && !nextRow.hasClass("footer-total")) {
						row.insertAfter(nextRow);
					}
				}
				const updatedSummary = [];
				container.find(".receipt-table tbody tr[data-idx]").each((i, tr) => {
					const idx = $(tr).data("idx");
					if (this.bagSummary[idx]) {
						updatedSummary.push(this.bagSummary[idx]);
					}
				});
				this.bagSummary = updatedSummary;
			});

		container
			.find(".save-continue-btn")
			.off("click")
			.on("click", async () => {
				const adjustments = this.adjustments || [];

				const hasPurityBlend = adjustments.some(
					(adj) => adj.type === "Purity Blend (Melting)"
				);

				if (!this.isFullyReconciled() && !hasPurityBlend) {
					frappe.msgprint({
						title: "Reconciliation Incomplete",
						message:
							"Please complete reconciliation (Δ = 0) for all purities before continuing to payments.",
						indicator: "orange",
					});
					return;
				}

				try {
					if (hasPurityBlend) {
						await this.callCreateMaterialReceiptAPI();
					}

					await this.callCreateSalesAndDeliveryAPI();

					frappe.show_alert({
						message: hasPurityBlend
							? "Sales created successfully."
							: "Sales created successfully.",
						indicator: "green",
					});

					if (this.continueCallback) this.continueCallback();
				} catch (error) {
					frappe.msgprint({
						title: "Error",
						message: `Failed to complete Save & Continue: ${error.message}`,
						indicator: "red",
					});
				}
			});
	}

	updateReconciliationSummary() {
		const container = this.container;

		// Precompute adjustment weight maps by type (per purity)
		const itemReturnMap = {};
		const weightLossMap = {};
		const weightAdjustStonesMap = {};
		const purityChangeOutMap = {}; // weights moved out from a purity
		const purityChangeInMap = {}; // weights moved into a purity

		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			const from = (adj.from_purity || "").trim();
			const to = (adj.to_purity || "").trim();
			const wt = parseFloat(adj.weight) || 0;

			if (!wt) return;

			if (type === "Item Return") {
				itemReturnMap[from] = (itemReturnMap[from] || 0) + wt;
			} else if (
				type === "Weight Loss - Torching/Cleaning" ||
				type === "Weight Loss - Other"
			) {
				weightLossMap[from] = (weightLossMap[from] || 0) + wt;
			} else if (type === "Weight Adjustment - Stones") {
				weightAdjustStonesMap[from] = (weightAdjustStonesMap[from] || 0) + wt;
			} else if (type === "Purity Change" || type === "Purity Blend (Melting)") {
				// For purity change, treat as moving wt from 'from' to 'to'
				purityChangeOutMap[from] = (purityChangeOutMap[from] || 0) + wt;
				purityChangeInMap[to] = (purityChangeInMap[to] || 0) + wt;
			}
		});

		// Build aggregated monetary impacts per purity (consistent with computeProfitImpactForRow)
		const adjustmentImpactMap = {}; // numeric RM adjustments per purity
		const { unit_revenue: __ur, unit_cost: __uc } = this.computeUnitMaps
			? this.computeUnitMaps()
			: { unit_revenue: {}, unit_cost: {} };

		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			const from = (adj.from_purity || "").trim();
			const to = (adj.to_purity || "").trim();
			const wt = parseFloat(adj.weight) || 0;
			if (!wt) return;

			const urFrom = (__ur && __ur[from]) || 0;
			const ucFrom = (__uc && __uc[from]) || 0;
			const urTo = (__ur && __ur[to]) || 0;
			const ucTo = (__uc && __uc[to]) || 0;

			let impactFrom = 0;
			let impactTo = 0;

			if (type === "Item Return") {
				impactFrom = -(urFrom - ucFrom) * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (
				type === "Weight Loss - Torching/Cleaning" ||
				type === "Weight Loss - Other"
			) {
				impactFrom = -urFrom * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (type === "Weight Adjustment - Stones") {
				impactFrom = (urFrom - ucFrom) * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (type === "Purity Change" || type === "Purity Blend (Melting)") {
				// margin difference moved from => to
				const margin_from = urFrom - ucFrom;
				const margin_to = urTo - ucTo;
				const net = (margin_to - margin_from) * wt;
				// net is positive if moving increases overall margin, negative otherwise.
				// Allocate negative impact on 'from' and positive on 'to'
				impactFrom = -net; // remove margin from 'from' (show as negative)
				impactTo = net; // add margin to 'to'
				adjustmentImpactMap[to] = (adjustmentImpactMap[to] || 0) + impactTo;
			}
		});

		// Iterate receipt rows and update reconciliation table rows
		const rows = container.find(".receipt-table tbody tr[data-idx]");

		// For faster lookup, load recon rows by purity key
		const reconMap = {};
		container.find(".recon-table tbody tr[data-purity]").each((_, r) => {
			const $r = $(r);
			const p = ($r.data("purity") || "").toString().trim();
			if (p) reconMap[p] = $r;
		});

		// --- Ensure all 'to' purities from Purity Blend (Melting) exist in reconciliation table ---
		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			if (type === "Purity Blend (Melting)") {
				const fromPurity = (adj.from_purity || "").trim();
				const toPurity = (adj.to_purity || "").trim();
				const addedWeight = parseFloat(adj.weight) || 0;

				if (!toPurity || !addedWeight) return;

				// If this purity doesn't exist yet, create a new row
				if (!reconMap[toPurity]) {
					const $tableBody = container.find(".recon-table tbody");
					const newRow = $(`
				<tr data-purity="${toPurity}">
					<td class="purity-cell">${toPurity}</td>
					<td class="actual-cell">0.00</td>
					<td class="claimed-cell">0.00</td>
					<td class="delta-cell">0.00</td>
					<td class="status-cell"><span class="status-icon warning">&#9888;</span></td>
					<td class="cost-basis">0.00</td>
					<td class="revenue-cell">RM 0.00</td>
					<td class="profit-cell">RM 0.00</td>
					<td class="profit-g-cell">RM 0.00</td>
					<td class="margin-cell">0.0%</td>
				</tr>
			`);
					newRow.attr("data-blend-row", "1");
					$tableBody.append(newRow);
					reconMap[toPurity] = newRow;

					// Copy cost basis and compute per-gram rate
					if (fromPurity && reconMap[fromPurity]) {
						const fromRow = reconMap[fromPurity];

						const fromCostBasis =
							parseFloat(
								fromRow
									.find(".cost-basis")
									.text()
									.replace(/[^\d.-]/g, "")
							) || 0;

						const fromClaimed =
							parseFloat(
								fromRow
									.find(".claimed-cell")
									.text()
									.replace(/[^\d.-]/g, "")
							) || 0;

						if (fromCostBasis > 0 && fromClaimed > 0) {
							const perGramRate = fromCostBasis / fromClaimed;
							const totalCost = perGramRate * addedWeight;

							newRow.find(".cost-basis").text(totalCost.toFixed(2));
							newRow.data("per-gram-rate", perGramRate); // store per-gram rate for later use

							console.log(
								`Copied cost basis ${fromCostBasis} from purity ${fromPurity} → ${toPurity}, per-gram rate ${perGramRate.toFixed(
									2
								)}`
							);
						} else {
							console.warn(
								`Source purity ${fromPurity} has 0 cost basis or 0 claimed weight.`
							);
						}
					} else {
						console.warn(`No valid source row found for from_purity ${fromPurity}.`);
					}
				}
			}
		});

		// We'll also update any recon rows that have no receipt row (e.g., a 'to' purity that only gets increased)
		// But first update based on receipt rows to get actual weights.
		rows.each((_, rowElem) => {
			const row = $(rowElem);
			const purityVal = (row.find(".input-purity").val() || "").toString().trim();
			const purity = purityVal || "";
			const weight = parseFloat(row.find(".input-weight").val()) || 0;
			const rate = parseFloat(row.find(".input-rate").val()) || 0;
			const amountInput = parseFloat(row.find(".input-amount").val());
			const amount = isNaN(amountInput) ? weight * rate : amountInput;

			if (!purity || !reconMap[purity]) return;

			const reconRow = reconMap[purity];
			let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;

			// Apply adjustments affecting this purity:
			const itemReturnWeight = itemReturnMap[purity] || 0;
			const weightLoss = weightLossMap[purity] || 0;
			const weightAdjustStones = weightAdjustStonesMap[purity] || 0;
			const purityOut = purityChangeOutMap[purity] || 0; // moved out
			const purityIn = purityChangeInMap[purity] || 0; // moved in

			// Effective claimed = baseClaimed - out (item return + purity out + weight loss) + in (purity in + stones adjust)
			const claimed =
				baseClaimed -
				itemReturnWeight -
				weightLoss -
				purityOut +
				purityIn +
				weightAdjustStones;

			// Show strikethrough -> new claimed when it changed
			if (Math.abs(claimed - baseClaimed) > 0.0009) {
				// If claimed decreased show original -> new, likewise for increase
				reconRow
					.find(".claimed-cell")
					.html(`<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`);
			} else {
				reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
			}

			// Actual is the physical weight in Section 1 for this row
			const actual = weight;
			const delta = (actual - claimed).toFixed(2);

			// Cost basis read from UI (existing behavior)
			const baseCostBasis =
				parseFloat(
					reconRow
						.find(".cost-basis")
						.text()
						.replace(/[^\d.-]/g, "")
				) || 0;

			// Compute revenue/profit,
			let revenue = 0,
				profit = 0,
				profitG = 0,
				margin = 0;
			let statusHTML = "";

			// When actual equals claimed and amount equals cost_basis (earlier logic)
			if (Math.abs(actual - claimed) < 0.001 && Math.abs(amount - baseCostBasis) < 0.001) {
				statusHTML = '<span class="status-icon success">&#10004;</span>';
				reconRow.addClass("recon-row-green");
			} else {
				revenue = amount;
				profit = revenue - baseCostBasis;

				// Apply aggregated adjustment impact for this purity (if any)
				const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
				profit += adjImpactForPurity;

				profitG = actual ? profit / actual : 0;
				margin = revenue ? (profit / revenue) * 100 : 0;

				const totalWeightAdjustments =
					itemReturnWeight + weightLoss + purityOut + weightAdjustStones - purityIn;
				// Adjust status logic conservatively: success if positive profit/g or revenue > cost (as before)
				if (
					(profit > 0 && totalWeightAdjustments > 0) ||
					profitG > 0 ||
					revenue > baseCostBasis
				) {
					statusHTML = '<span class="status-icon success">&#10004;</span>';
					reconRow.addClass("recon-row-green");
				} else {
					statusHTML = '<span class="status-icon warning">&#9888;</span>';
					reconRow.removeClass("recon-row-green");
				}
			}

			// Update reconciliation cells
			reconRow.find(".actual-cell").text(actual.toFixed(2));
			reconRow.find(".delta-cell").text(delta);
			reconRow
				.find(".revenue-cell")
				.text(`RM ${revenue.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow
				.find(".profit-cell")
				.text(`RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow
				.find(".profit-g-cell")
				.text(`RM ${profitG.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
			reconRow.find(".status-cell").html(statusHTML);
		});

		// Additionally, update recon rows that are present in reconciliation table but not linked to a receipt row:
		// (these might be pure 'to' purities that just got increased)
		Object.keys(reconMap).forEach((purity) => {
			// if there is no receipt-row with this purity, still update the claimed to reflect purityChangeInMap
			const reconRow = reconMap[purity];
			const hasReceiptRow = !!container
				.find(`.receipt-table tbody tr[data-idx] .input-purity`)
				.filter(function () {
					return ($(this).val() || "").trim() === purity;
				}).length;

			if (!hasReceiptRow) {
				let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;

				const purityIn = purityChangeInMap[purity] || 0;
				const purityOut = purityChangeOutMap[purity] || 0;
				const itemReturnWeight = itemReturnMap[purity] || 0;
				const weightLoss = weightLossMap[purity] || 0;
				const weightAdjustStones = weightAdjustStonesMap[purity] || 0;

				const claimed =
					baseClaimed -
					itemReturnWeight -
					weightLoss -
					purityOut +
					purityIn +
					weightAdjustStones;

				if (Math.abs(claimed - baseClaimed) > 0.0009) {
					reconRow
						.find(".claimed-cell")
						.html(`<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`);
				} else {
					reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
				}

				// For these, actual remains whatever existing value is (likely 0), so just update claimed and impacts
				const actual = parseFloat(reconRow.find(".actual-cell").text()) || 0;
				const delta = (actual - claimed).toFixed(2);

				let baseCostBasis =
					parseFloat(
						reconRow
							.find(".cost-basis")
							.text()
							.replace(/[^\d.-]/g, "")
					) || 0;

				let revenue = 0,
					profit = 0,
					profitG = 0,
					margin = 0;
				let statusHTML = "";

				const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
				profit = revenue - baseCostBasis + adjImpactForPurity;
				profitG = actual ? profit / actual : 0;
				margin = revenue ? (profit / revenue) * 100 : 0;

				if (profit > 0 || profitG > 0) {
					statusHTML = '<span class="status-icon success">&#10004;</span>';
					reconRow.addClass("recon-row-green");
				} else {
					statusHTML = '<span class="status-icon warning">&#9888;</span>';
					reconRow.removeClass("recon-row-green");
				}

				reconRow.find(".delta-cell").text(delta);
				reconRow
					.find(".profit-cell")
					.text(`RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
				reconRow
					.find(".profit-g-cell")
					.text(`RM ${profitG.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
				reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
				reconRow.find(".status-cell").html(statusHTML);
			}
		});
	}

	bindAdjustmentEvents() {
		const tbody = this.container.find(".section3-adjustments tbody");

		tbody.off("click", ".btn-delete-row").on("click", ".btn-delete-row", (e) => {
			$(e.currentTarget).closest("tr").remove();
			tbody.find("tr").each((i, tr) => {
				$(tr)
					.find("td:first")
					.text(i + 1);
			});
			this.updateReconciliationSummary();
		});

		tbody.off("input.adjust-update").on("input.adjust-update", "input,select", (e) => {
			const $changedRow = $(e.currentTarget).closest("tr");
			// Compute impact only for changed row
			this.computeProfitImpactForRow($changedRow);

			// Update adjustments array fully after change
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const $tr = $(tr);
				this.adjustments.push({
					type: $tr.find(".adjust-type").val(),
					from_purity: $tr.find(".from-purity").val(),
					to_purity: $tr.find(".to-purity").val(),
					weight: $tr.find(".weight").val(),
					notes: $tr.find(".notes").val(),
					impact: $tr.find(".profit-impact").text(),
				});
			});

			// Update reconciliation summary
			this.updateReconciliationSummary();
		});

		tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
			const row = $(e.currentTarget).closest("tr");
			this.toggleToPurityField(row);
			this.updateReconciliationSummary();
		});

		tbody.off("input", ".from-purity").on("input", ".from-purity", function () {
			const row = $(this).closest("tr");
			const adjustmentType = row.find(".adjust-type").val();
			if (
				[
					"Weight Loss - Torching/Cleaning",
					"Weight Loss - Other",
					"Weight Adjustment - Stones",
				].includes(adjustmentType)
			) {
				row.find(".to-purity").val($(this).val());
			}
		});
	}

	isFullyReconciled() {
		let reconciled = true;
		this.container.find(".recon-table tbody tr").each((_, tr) => {
			const delta = parseFloat($(tr).find(".delta-cell").text());
			const isGreen = $(tr).hasClass("recon-row-green");
			if (Math.abs(delta) > 0.001 || !isGreen) {
				reconciled = false;
				return false; // exit loop early if any row fails
			}
		});
		return reconciled;
	}

	async callCreateSalesAndDeliveryAPI() {
		if (!this.props.customer) {
			throw new Error("Customer info missing.");
		}

		const warehouse = this.props.selected_bag + " - AGSB";
		const items = this.bagSummary.map((line) => {
			const purityStr = line.purity || "";
			return {
				item_code: `Unsorted-${purityStr}`,
				purity: purityStr,
				weight: parseFloat(line.weight) || 0,
				rate: parseFloat(line.rate) || 0,
				warehouse: warehouse,
			};
		});

		const payload = {
			customer: this.props.customer,
			items: JSON.stringify(items),
			company: this.props.company || null,
		};

		console.log("Calling create_sales_invoice API with payload:", payload);

		await new Promise((resolve, reject) => {
			frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.create_sales_invoice",
				args: payload,
				callback: (r) => {
					console.log("API response:", r);
					if (r.message && r.message.status === "success") {
						console.log("API response message full content:", r.message);
						const invoiceRef = r.message.sales_invoice; // or whatever field contains the invoice ref
						if (this.onSalesInvoiceCreated) {
							this.onSalesInvoiceCreated(invoiceRef); // call callback
						}
						resolve(r.message);
					} else {
						reject(new Error("API returned failure"));
					}
				},
				errorHandler: (err) => {
					console.error("API call error:", err);
					reject(err);
				},
			});
		});
	}

	async callCreateMaterialReceiptAPI() {
		try {
			// Collect Purity Blend (Melting) items
			const items = [];
			(this.adjustments || []).forEach((adj) => {
				const type = adj.type;
				if (type === "Purity Blend (Melting)") {
					const toPurity = (adj.to_purity || "").trim();
					const addedWeight = parseFloat(adj.weight) || 0;

					if (!toPurity || !addedWeight) return;

					// Get cost basis and actual weight for this purity
					const row = this.container.find(`.recon-table tr[data-purity='${toPurity}']`);
					const costBasis = parseFloat(row.find(".cost-basis").text()) || 0;
					const actualWeight = parseFloat(row.find(".actual-cell").text()) || 0;

					// Try getting pre-stored per-gram rate
					let basicRate = parseFloat(row.data("per-gram-rate")) || 0;

					// If not found, fallback calculation
					if (!basicRate && actualWeight > 0) {
						basicRate = costBasis / actualWeight;
					}

					items.push({
						purity: toPurity,
						qty: addedWeight,
						basic_rate: basicRate,
					});
				}
			});

			console.log("Material Receipt Items:", items);

			if (items.length === 0) {
				console.log("No Purity Blend items found to create stock entry.");
				return;
			}

			// Call backend API to create Stock Entry
			await frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.create_material_receipt",
				args: { items },
				freeze: true,
				freeze_message: "Creating Material Receipt...",
				callback: (r) => {
					if (r.message) {
						frappe.show_alert({
							message: `Stock Entry Created: ${r.message.stock_entry_name}`,
							indicator: "green",
						});
					}
				},
			});
		} catch (error) {
			console.error("Error creating Material Receipt:", error);
			frappe.msgprint({
				title: "Error",
				message: `Failed to create Material Receipt: ${error.message}`,
				indicator: "red",
			});
		}
	}

	bindUploadReceipt() {
		const container = this.container;
		if (container.find("#hidden-upload-input").length === 0) {
			const fileInput = $(
				'<input type="file" id="hidden-upload-input" style="display:none" />'
			);
			container.append(fileInput);
			fileInput.on("change", (e) => {
				const file = e.target.files[0];
				if (!file) return;
				this.pendingReceiptFile = file; // Save the file object for later
				frappe.show_alert({
					message: `Receipt "${file.name}" selected, will be uploaded on Save.`,
					indicator: "green",
				});
			});
		}
		container
			.find(".btn-upload-receipt")
			.off("click")
			.on("click", () => {
				container.find("#hidden-upload-input").click();
			});
	}

	uploadReceiptFile(transactionName) {
		if (!this.pendingReceiptFile) return;
		const file = this.pendingReceiptFile;
		const reader = new FileReader();
		reader.onload = (ev) => {
			frappe.call({
				method: "frappe.client.attach_file",
				args: {
					doctype: "Wholesale Transaction",
					docname: transactionName, // now the valid docname!
					filedata: ev.target.result.split(",")[1],
					filename: file.name,
					is_private: 1,
				},
				callback: (r) => {
					if (r.message && r.message.file_url) {
						// Update the transaction's upload_receipt field after attaching
						frappe.call({
							method: "frappe.client.set_value",
							args: {
								doctype: "Wholesale Transaction",
								name: transactionName,
								fieldname: "upload_receipt",
								value: r.message.file_url,
							},
							callback: () => {
								frappe.show_alert({
									message: "Receipt file linked successfully!",
									indicator: "green",
								});
							},
						});
					}
				},
			});
		};
		reader.readAsDataURL(file);
	}

	onClickSaveAdjustments() {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Wholesale Transaction",
				filters: { wholesale_bag: this.props.selected_bag },
				fields: ["name"],
			},
			callback: (res) => {
				let transactionDoc = {
					doctype: "Wholesale Transaction",
					wholesale_bag: this.props.selected_bag,
					buyer: this.props.customer,
					buyer_name: this.props.buyer_name || "",
					sale_date: this.props.sale_date,
					total_cost_basis: this.props.totalAmount,
					receipt_lines: this.bagSummary.map((line) => ({
						purity: line.purity,
						weight: line.weight,
						rate: line.rate,
						amount: line.amount,
					})),
					reconciliation_lines: [],
					adjustments: this.adjustments.map((adj) => ({
						adjustment_type: adj.type,
						from_purity: adj.from_purity,
						to_purity: adj.to_purity,
						weight: adj.weight,
						notes: adj.notes,
						profit_impact: adj.impact,
					})),
				};

				this.container.find(".recon-table tbody tr").each((_, tr) => {
					const $tr = $(tr);
					transactionDoc.reconciliation_lines.push({
						purity: $tr.find("td:eq(0)").text().trim(),
						actual: parseFloat($tr.find(".actual-cell").text()) || 0,
						claimed: parseFloat($tr.find(".claimed-cell").text()) || 0,
						delta: parseFloat($tr.find(".delta-cell").text()) || 0,
						status: $tr.find(".status-cell").text().trim() || "",
						cost_basis:
							parseFloat(
								$tr
									.find(".cost-basis")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						revenue:
							parseFloat(
								$tr
									.find(".revenue-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						profit:
							parseFloat(
								$tr
									.find(".profit-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						profit_g:
							parseFloat(
								$tr
									.find(".profit-g-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						margin_percent: parseFloat($tr.find(".margin-cell").text()) || 0,
					});
				});

				// 1. Transaction exists: update, then upload
				if (res.message && res.message.length > 0) {
					const docname = res.message[0].name;

					frappe.call({
						method: "frappe.client.get",
						args: { doctype: "Wholesale Transaction", name: docname },
						callback: (r) => {
							if (r.message) {
								Object.assign(r.message, transactionDoc);
								frappe.call({
									method: "frappe.client.save",
									args: { doc: r.message },
									callback: (saveRes) => {
										frappe.show_alert({
											message: "Transaction updated successfully.",
											indicator: "green",
										});
										this.uploadReceiptFile(docname); // <- Always use docname!
									},
									error: (e) => {
										frappe.msgprint("Update failed: " + (e.message || e));
									},
								});
							}
						},
						error: (e) => {
							frappe.msgprint("Failed to fetch latest doc: " + (e.message || e));
						},
					});
				} else {
					// 2. New transaction: insert, then upload receipt
					frappe.call({
						method: "frappe.client.insert",
						args: { doc: transactionDoc },
						callback: (insertRes) => {
							frappe.show_alert({
								message: "Transaction saved successfully.",
								indicator: "green",
							});
							if (insertRes.message && insertRes.message.name) {
								this.uploadReceiptFile(insertRes.message.name); // <- Use the REAL docname!
							}
						},
						error: (e) => {
							frappe.msgprint("Save failed: " + (e.message || e));
						},
					});
				}
			},
			error: (e) => {
				frappe.msgprint("Error searching for transaction: " + (e.message || e));
			},
		});
	}

	// Prfit Impact
	computeUnitMaps() {
		const unit_revenue = {};
		const unit_cost = {};

		// Build unit_revenue from receipt-table rows
		this.container.find(".receipt-table tbody tr[data-idx]").each((_, tr) => {
			const $tr = $(tr);
			const purity = ($tr.find(".input-purity").val() || "").trim();
			const w = parseFloat($tr.find(".input-weight").val()) || 0;
			const a = parseFloat($tr.find(".input-amount").val()) || 0;
			if (purity && w > 0) {
				// If multiple rows for same purity, last one will overwrite; acceptable for simplicity.
				unit_revenue[purity] = a / w;
			}
		});

		// Build unit_cost from reconSummary (use DOM cost-basis cell as source of truth)
		this.container.find(".recon-table tbody tr[data-purity]").each((_, tr) => {
			const $tr = $(tr);
			const purity = $tr.data("purity");
			const claimed =
				parseFloat(
					$tr
						.find(".claimed-cell")
						.text()
						.replace(/[^\d.-]/g, "")
				) || 0;
			const costText = $tr
				.find(".cost-basis")
				.text()
				.replace(/[^\d.-]/g, "");
			const cost = parseFloat(costText) || 0;
			if (purity && claimed > 0) {
				unit_cost[purity] = cost / claimed;
			} else {
				unit_cost[purity] = 0;
			}
		});

		return { unit_revenue, unit_cost };
	}

	computeProfitImpactForRow($row) {
		const type = $row.find(".adjust-type").val();
		if (type === "Purity Blend (Melting)") {
			// For purity blend, do not update profit impact
			$row.find(".profit-impact")
				.text("+RM 0.00")
				.removeClass("text-danger")
				.addClass("text-success");
			return 0;
		}
		const from = ($row.find(".from-purity").val() || "").trim();
		const to = ($row.find(".to-purity").val() || "").trim();
		const weight = parseFloat($row.find(".weight").val()) || 0;

		const { unit_revenue, unit_cost } = this.computeUnitMaps();

		const getUR = (p) => unit_revenue[p] || 0;
		const getUC = (p) => unit_cost[p] || 0;

		let impact = 0;

		switch (type) {
			case "Item Return":
				// Profit lost = gross margin per g * weight
				impact = -(getUR(from) - getUC(from)) * weight;
				break;
			case "Weight Loss - Torching/Cleaning":
			case "Weight Loss - Other":
				// Revenue lost (conservative)
				impact = -getUR(from) * weight;
				break;
			case "Weight Adjustment - Stones":
				// Stones removal increases saleable weight → gains margin
				impact = (getUR(from) - getUC(from)) * weight;
				break;
			case "Purity Change":
			case "Purity Blend (Melting)":
				// For this adjustment row, impact depends on whether this row relates to 'from' or 'to' purity
				if (
					$row.find(".from-purity").is(":focus") ||
					$row.find(".to-purity").is(":focus")
				) {
					// No change—just keep logic to calculate net margin difference * weight
				}
				// Clarify impact per each purity side:
				// Since UI row represents entire adjustment, show net impact as positive if profit improves, negative otherwise
				const marginFrom = getUR(from) - getUC(from);
				const marginTo = getUR(to) - getUC(to);
				// net margin change per gram
				const netMarginDifference = marginTo - marginFrom;
				impact = netMarginDifference * weight;
				break;

			default:
				impact = 0;
		}

		// Update UI cell text with sign and two decimals
		// --- Update UI cell styling and text based on sign ---
		const $impactCell = $row.find(".profit-impact");
		const sign = impact >= 0 ? "+" : "-";
		const absVal = Math.abs(impact).toFixed(2);
		$impactCell.text(`${sign}RM ${absVal}`);

		// Apply color classes
		if (impact >= 0) {
			$impactCell.removeClass("text-danger").addClass("text-success");
		} else {
			$impactCell.removeClass("text-success").addClass("text-danger");
		}

		// return signed numeric value
		return impact;
	}
}

// 7 Nov 2025

class Step3TabReceiptReconciliation {
	constructor(
		props,
		container,
		backCallback,
		continueCallback,
		syncDataCallback,
		onSalesInvoiceCreated
	) {
		this.props = props;
		this.container = container;
		this.backCallback = backCallback;
		this.continueCallback = continueCallback;
		this.syncDataCallback = syncDataCallback;
		this.onSalesInvoiceCreated = onSalesInvoiceCreated;
		this.reconSummary = props.reconSummary.length
			? props.reconSummary
			: this.initializeReconSummary();
		this.adjustments = props.adjustments;
		this.bagSummary = [];
		this.uploadedReceiptUrl = "";
		this.availablePurities = [];

		this.showLoader();

		this.fetchPuritiesFromDoctype().then((purities) => {
			this.availablePurities = purities;
			this.render();
			this.bindReceiptEvents();
			this.bindUploadReceipt();
			this.renderAdjustmentsSection();
			this.attachNavHandlers();

			this.hideLoader();
		});
	}

	showLoader() {
		this.container.html(`
            <div class="loader-overlay">
                <div class="loader"></div>
                <p>Loading receipt details, please wait...</p>
            </div>
        `);
	}

	hideLoader() {}

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

	renderAndBindAll() {
		this.render();
		this.bindReceiptEvents();
		this.bindUploadReceipt();
		this.renderAdjustmentsSection();
		this.attachNavHandlers();
		this.updateReconciliationSummary();
	}

	async fetchPuritiesFromDoctype() {
		try {
			const response = await frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Purity",
					fields: ["name"],
					limit_page_length: 100,
					order_by: "name asc",
				},
			});
			// Extract purity names from result
			return response.message.map((item) => item.name);
		} catch (error) {
			console.error("Error fetching purities:", error);
			return [];
		}
	}

	render() {
		this.container.html(`
        <div class="section1-buyer-receipt">
            <h4 class="section-title">Section 1: Buyer's Official Receipt</h4>
            <p class="input-caption">Enter what the buyer actually paid for</p>
            <table class="receipt-table">
                <thead><tr><th>Move</th><th>Purity</th><th>Weight (g) *</th><th>Rate (RM/g)</th><th>Amount (RM)</th><th>Action</th></tr></thead>
                <tbody></tbody>
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
                <tbody></tbody>
            </table>
        </div>
        <hr>
        <div class="section3-adjustments">
            <h4 class="section-title">Section 3: Adjustments</h4>
            <p class="input-caption">Add adjustment rows until Claimed = Actual</p>
            <table class="adjust-table">
                <thead><tr><th>#</th><th>Adjustment Type</th><th>From Purity</th><th>To Purity</th><th>Weight (g)</th><th>Notes / Remarks</th><th>Profit Impact</th><th>Delete</th></tr></thead>
                <tbody></tbody>
            </table>
            <button class="add-adjustment-btn btn-adjustment">+ Add Adjustment</button>
            <button class="save-adjustments-btn btn-save-green">Save All Adjustments</button>
        </div>
        <hr>
        <div class="recon-action-buttons">
            <button class="back-to-sale-btn btn-back">← Back to Sale Details</button>
            <button class="save-continue-btn btn-save-green">Save & Continue to Payments →</button>
        </div>
    `);

		// Call three section renders to fill tbody's
		this.renderReceiptSection();
		this.renderReconciliationSection();
		this.renderAdjustmentsSection();
	}

	renderReceiptSection() {
		const purities = this.availablePurities;

		// Helper to build options html
		const purityOptions = (selected) => {
			const blankOption = `<option value="" ${
				selected === "" ? "selected" : ""
			} disabled>Select</option>`;
			const otherOptions = purities
				.map(
					(p) => `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`
				)
				.join("");
			return blankOption + otherOptions;
		};

		const receiptLines = this.bagSummary
			.map(
				(r, idx) => `
            <tr data-idx="${idx}">
                <td><span class="move-arrows"><span class="up-arrow">&#9650;</span><span class="down-arrow">&#9660;</span></span></td>
             <td>
  <input list="purity-list-${idx}" class="input-purity" value="${r.purity}">
  <datalist id="purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                <td><input type="number" class="input-weight" value="${
					r.weight ? r.weight.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-rate" value="${
					r.rate ? r.rate.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><input type="number" class="input-amount" value="${
					r.amount ? r.amount.toFixed(2) : "0.00"
				}" data-purity="${r.purity}"></td>
                <td><button class="delete-row-btn" data-idx="${idx}">&#128465;</button></td>
            </tr>
        `
			)
			.join("");

		const receiptTable = this.container.find(
			".section1-buyer-receipt table.receipt-table tbody"
		);
		if (receiptTable.length) {
			receiptTable.html(`${receiptLines}
            <tr class="footer-total">
                <td colspan="2">TOTAL</td>
                <td class="total-weight">0.00 g</td>
                <td>-</td>
                <td class="total-amount">RM 0.00</td>
                <td></td>
            </tr>`);
		} else {
			// Initial render case - call full render to set HTML first
			this.render();
		}
	}

	renderReconciliationSection() {
		const reconRows = this.reconSummary
			.map(
				(r) => `
            <tr data-idx="${r.purity}" data-purity="${r.purity}">
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
            </tr>
        `
			)
			.join("");

		this.container.find(".section2-recon-summary table.recon-table tbody").html(reconRows);
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
		const section = this.container.find(".section3-adjustments");
		const tbody = section.find("tbody");
		tbody.empty();
		const purities = this.availablePurities; // get fresh purity list

		const addRow = () => {
			const idx = tbody.children().length + 1;
			const optionHTML = adjustmentOptions
				.map((o) => `<option value="${o}">${o}</option>`)
				.join("");

			const row = $(`
                <tr data-idx="${idx}">
                    <td>${idx}</td>
					<td class="adjustment-type-cell">
            <div class="adjustment-controls">
                <select class="adjust-type">${optionHTML}</select>
                <button class="btn-create-purity">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"/>
                    </svg>
                    Create Purity
                </button>
            </div>
        </td>
                    <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

                    <td><input type="number" class="weight" placeholder="0" /></td>
                    <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
                    <td class="profit-impact text-success">+RM 0.00</td>
                    <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
                </tr>
            `);
			tbody.append(row);
			// update the impact display for this freshly-added row
			this.computeProfitImpactForRow(tbody.find("tr").last());
		};

		section
			.find(".add-adjustment-btn")
			.off("click")
			.on("click", () => {
				const tbody = section.find("tbody");
				const idx = tbody.children().length + 1;
				const optionHTML = adjustmentOptions
					.map((o) => `<option value="${o}">${o}</option>`)
					.join("");
				const purities = this.availablePurities;
				const row = $(`
        <tr data-idx="${idx}">
            <td>${idx}</td>
			 <td class="adjustment-type-cell">
            <div class="adjustment-controls">
                <select class="adjust-type">${optionHTML}</select>
                <button class="btn-create-purity">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"/>
                    </svg>
                    Create Purity
                </button>
            </div>
        </td>
            <td>
  <input list="from-purity-list-${idx}" class="from-purity" />
  <datalist id="from-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>
<td>
  <input list="to-purity-list-${idx}" class="to-purity" />
  <datalist id="to-purity-list-${idx}">
    ${purities.map((p) => `<option value="${p}">`).join("")}
  </datalist>
</td>

            <td><input type="number" class="weight" placeholder="0" /></td>
            <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
            <td class="profit-impact text-success">+RM 0.00</td>
            <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
        </tr>
    `);
				tbody.append(row);
				this.bindAdjustmentEvents();
				this.updateReconciliationSummary();
			});

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
				tbody.find("tr").each((_, tr) => {
					const row = $(tr);
					adjustments.push({
						type: row.find(".adjust-type").val(),
						from_purity: row.find(".from-purity").val(),
						to_purity: row.find(".to-purity").val(),
						weight: row.find(".weight").val(),
						notes: row.find(".notes").val(),
						impact: row.find(".profit-impact").text(),
					});
				});

				this.adjustments = adjustments;

				const hasPurityBlend = adjustments.some(
					(adj) => adj.type === "Purity Blend (Melting)"
				);

				if (!this.isFullyReconciled() && !hasPurityBlend) {
					frappe.msgprint({
						title: "Reconciliation Incomplete",
						message:
							"Please complete reconciliation (Δ = 0) for all purities before saving.",
						indicator: "orange",
					});
					return;
				}

				this.onClickSaveAdjustments();

				frappe.show_alert({
					message: hasPurityBlend
						? "Adjustments saved (Purity Blend entries will be handled separately)."
						: "Adjustments saved successfully.",
					indicator: "green",
				});
			});

		addRow();

		// After "addRow();" and after setting up existing handlers:

		// Handler for ANY adjustment value changes (type, from_purity, weight)
		// canonical single handler for adjustment input changes
		tbody.off("input.adjust-update").on("input.adjust-update", "input,select", (e) => {
			const $changedRow = $(e.currentTarget).closest("tr");
			// Compute impact only for changed row
			this.computeProfitImpactForRow($changedRow);

			// Update adjustments array fully after change
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const $tr = $(tr);
				this.adjustments.push({
					type: $tr.find(".adjust-type").val(),
					from_purity: $tr.find(".from-purity").val(),
					to_purity: $tr.find(".to-purity").val(),
					weight: $tr.find(".weight").val(),
					notes: $tr.find(".notes").val(),
					impact: $tr.find(".profit-impact").text(),
				});
			});

			// Update reconciliation summary
			this.updateReconciliationSummary();
		});

		// Function to toggle visibility of 'To Purity' field in a given row based on selected adjustment type
		const toggleToPurityField = (row) => {
			const adjustmentType = row.find(".adjust-type").val();
			const toPurityInput = row.find(".to-purity");
			const fromPurityInput = row.find(".from-purity");
			if (adjustmentType === "Item Return") {
				toPurityInput.val("").hide().prop("readonly", false);
			} else if (
				adjustmentType === "Weight Loss - Torching/Cleaning" ||
				adjustmentType === "Weight Loss - Other" ||
				adjustmentType === "Weight Adjustment - Stones"
			) {
				toPurityInput.show().prop("readonly", true);
				toPurityInput.val(fromPurityInput.val());
			} else {
				toPurityInput.show().prop("readonly", false);
			}
		};

		// Initial toggle on all existing rows
		tbody.find("tr").each((_, tr) => {
			toggleToPurityField($(tr));
		});

		// Event handler for change on adjustment type select dropdown
		tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const selectedType = $(e.currentTarget).val();
			const createPurityBtn = row.find(".btn-create-purity");

			// NEW: Show/hide Create Purity button based on selection
			if (selectedType === "Purity Blend (Melting)") {
				createPurityBtn.show();
			} else {
				createPurityBtn.hide();
			}

			toggleToPurityField(row);
			// Same as above: refresh adjustments and update recon
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const row = $(tr);
				this.adjustments.push({
					type: row.find(".adjust-type").val(),
					from_purity: row.find(".from-purity").val(),
					to_purity: row.find(".to-purity").val(),
					weight: row.find(".weight").val(),
					notes: row.find(".notes").val(),
					impact: row.find(".profit-impact").text(),
				});
			});
			this.updateReconciliationSummary();
		});

		// NEW: Event handler for Create Purity button click
		tbody.off("click", ".btn-create-purity").on("click", ".btn-create-purity", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showCreatePurityDialog();
		});

		// Real-time sync from_purity to to_purity for weight loss rows
		tbody.on("input", ".from-purity", function () {
			const row = $(this).closest("tr");
			const adjustmentType = row.find(".adjust-type").val();
			if (
				adjustmentType === "Weight Loss - Torching/Cleaning" ||
				adjustmentType === "Weight Loss - Other" ||
				adjustmentType === "Weight Adjustment - Stones"
			) {
				row.find(".to-purity").val($(this).val());
			}
		});
	}

	attachNavHandlers() {
		this.container.find(".back-to-sale-btn").on("click", this.backCallback);
		this.container
			.find(".save-continue-btn")
			.off("click")
			.on("click", async () => {
				try {
					await this.callCreateSalesAndDeliveryAPI();
					frappe.show_alert({
						message: "Sales and Delivery created successfully",
						indicator: "green",
					});
					if (this.continueCallback) this.continueCallback();
				} catch (error) {
					frappe.msgprint({
						title: "Error",
						message: `Failed to create sales and delivery: ${error.message}`,
						indicator: "red",
					});
				}
			});
	}

	bindReceiptEvents() {
		const container = this.container;

		container
			.find(".add-receipt-line-btn")
			.off("click")
			.on("click", () => {
				const newRow = {
					purity: "",
					weight: 0,
					rate: 0,
					amount: 0,
				};
				this.bagSummary.push(newRow);
				this.renderReceiptSection();
				this.bindReceiptEvents(); // Re-bind receipt events
				this.updateReconciliationSummary();
			});

		container.on("click", ".delete-row-btn", (e) => {
			const idx = $(e.currentTarget).data("idx");
			this.bagSummary.splice(idx, 1); // Remove from data array

			$(e.currentTarget).closest("tr").remove();

			this.renderReceiptSection();
			this.bindReceiptEvents();
			this.updateReconciliationSummary();
		});

		// Purity field event handler
		container.on("input", ".input-purity", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.data("idx");
			this.bagSummary[idx].purity = $(e.currentTarget).val();
		});

		container.find(".input-weight, .input-rate, .input-amount").on("blur", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.index();

			let weight = parseFloat(row.find(".input-weight").val()) || 0;
			let rate = parseFloat(row.find(".input-rate").val()) || 0;
			let amount = parseFloat(row.find(".input-amount").val()) || 0;
			const inputClass = $(e.currentTarget).attr("class");

			if (inputClass.includes("input-weight") && !inputClass.includes("input-amount")) {
				if (rate > 0) {
					amount = weight * rate;
				} else if (amount > 0 && weight > 0) {
					rate = amount / weight;
				} else {
					amount = 0;
					rate = 0;
				}
			} else if (inputClass.includes("input-rate") && !inputClass.includes("input-amount")) {
				if (weight > 0) {
					amount = weight * rate;
				} else if (amount > 0 && rate > 0) {
					weight = amount / rate;
				} else {
					amount = 0;
					weight = 0;
				}
			} else if (inputClass.includes("input-amount")) {
				if (weight > 0) {
					rate = amount / weight;
				} else if (rate > 0) {
					weight = amount / rate;
				} else {
					weight = 0;
					rate = 0;
				}
			}

			// Format on blur: always to 2 decimals
			row.find(".input-weight").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});
			row.find(".input-rate").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});
			row.find(".input-amount").val(function (_, v) {
				v = parseFloat(v) || 0;
				return v.toFixed(2);
			});

			if (this.bagSummary[idx]) {
				this.bagSummary[idx].weight = weight;
				this.bagSummary[idx].rate = rate;
				this.bagSummary[idx].amount = amount;
			}

			let totalWeight = 0,
				totalAmount = 0;
			this.bagSummary.forEach((r) => {
				totalWeight += r.weight || 0;
				totalAmount += r.amount || 0;
			});

			container
				.find(".receipt-table .footer-total .total-weight")
				.text(`${totalWeight.toFixed(2)} g`);
			container
				.find(".receipt-table .footer-total .total-amount")
				.text(`RM ${totalAmount.toFixed(2)}`);
			this.updateReconciliationSummary();
		});

		container.find(".input-weight, .input-amount").on("input", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const idx = row.index();

			let weight = parseFloat(row.find(".input-weight").val()) || 0;
			let amount = parseFloat(row.find(".input-amount").val()) || 0;

			if (weight > 0 && amount > 0) {
				const rate = amount / weight;
				row.find(".input-rate").val(rate.toFixed(2));
				if (this.bagSummary[idx]) {
					this.bagSummary[idx].rate = rate;
				}
			} else {
				row.find(".input-rate").val("0.00");
				if (this.bagSummary[idx]) {
					this.bagSummary[idx].rate = 0;
				}
			}
		});

		container.on("input", ".input-weight, .input-amount", () => {
			let totalWeight = 0,
				totalAmount = 0;
			container.find(".receipt-table tbody tr").each(function () {
				const weight = parseFloat($(this).find(".input-weight").val()) || 0;
				const amount = parseFloat($(this).find(".input-amount").val()) || 0;
				totalWeight += weight;
				totalAmount += amount;
			});

			container
				.find(".receipt-table .footer-total .total-weight")
				.text(`${totalWeight.toFixed(2)} g`);
			container
				.find(".receipt-table .footer-total .total-amount")
				.text(`RM ${totalAmount.toFixed(2)}`);
		});

		container
			.find(".up-arrow, .down-arrow")
			.off("click")
			.on("click", (e) => {
				const isUp = $(e.currentTarget).hasClass("up-arrow");
				const row = $(e.currentTarget).closest("tr");
				if (isUp) {
					const prevRow = row.prev("tr");
					if (prevRow.length && !prevRow.hasClass("footer-total")) {
						row.insertBefore(prevRow);
					}
				} else {
					const nextRow = row.next("tr");
					if (nextRow.length && !nextRow.hasClass("footer-total")) {
						row.insertAfter(nextRow);
					}
				}
				const updatedSummary = [];
				container.find(".receipt-table tbody tr[data-idx]").each((i, tr) => {
					const idx = $(tr).data("idx");
					if (this.bagSummary[idx]) {
						updatedSummary.push(this.bagSummary[idx]);
					}
				});
				this.bagSummary = updatedSummary;
			});

		container
			.find(".save-continue-btn")
			.off("click")
			.on("click", async () => {
				const adjustments = this.adjustments || [];

				const hasPurityBlend = adjustments.some(
					(adj) => adj.type === "Purity Blend (Melting)"
				);

				if (!this.isFullyReconciled() && !hasPurityBlend) {
					frappe.msgprint({
						title: "Reconciliation Incomplete",
						message:
							"Please complete reconciliation (Δ = 0) for all purities before continuing to payments.",
						indicator: "orange",
					});
					return;
				}

				try {
					if (hasPurityBlend) {
						await this.callCreateMaterialReceiptAPI();
					}

					await this.callCreateSalesAndDeliveryAPI();

					frappe.show_alert({
						message: hasPurityBlend
							? "Sales created successfully."
							: "Sales created successfully.",
						indicator: "green",
					});

					if (this.continueCallback) this.continueCallback();
				} catch (error) {
					frappe.msgprint({
						title: "Error",
						message: `Failed to complete Save & Continue: ${error.message}`,
						indicator: "red",
					});
				}
			});
	}

	updateReconciliationSummary() {
		const container = this.container;

		// Precompute adjustment weight maps by type (per purity)
		const itemReturnMap = {};
		const weightLossMap = {};
		const weightAdjustStonesMap = {};
		const purityChangeOutMap = {}; // weights moved out from a purity
		const purityChangeInMap = {}; // weights moved into a purity

		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			const from = (adj.from_purity || "").trim();
			const to = (adj.to_purity || "").trim();
			const wt = parseFloat(adj.weight) || 0;

			if (!wt) return;

			if (type === "Item Return") {
				itemReturnMap[from] = (itemReturnMap[from] || 0) + wt;
			} else if (
				type === "Weight Loss - Torching/Cleaning" ||
				type === "Weight Loss - Other"
			) {
				weightLossMap[from] = (weightLossMap[from] || 0) + wt;
			} else if (type === "Weight Adjustment - Stones") {
				weightAdjustStonesMap[from] = (weightAdjustStonesMap[from] || 0) + wt;
			} else if (type === "Purity Change" || type === "Purity Blend (Melting)") {
				// For purity change, treat as moving wt from 'from' to 'to'
				purityChangeOutMap[from] = (purityChangeOutMap[from] || 0) + wt;
				purityChangeInMap[to] = (purityChangeInMap[to] || 0) + wt;
			}
		});

		// Build aggregated monetary impacts per purity (consistent with computeProfitImpactForRow)
		const adjustmentImpactMap = {}; // numeric RM adjustments per purity
		const { unit_revenue: __ur, unit_cost: __uc } = this.computeUnitMaps
			? this.computeUnitMaps()
			: { unit_revenue: {}, unit_cost: {} };

		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			const from = (adj.from_purity || "").trim();
			const to = (adj.to_purity || "").trim();
			const wt = parseFloat(adj.weight) || 0;
			if (!wt) return;

			const urFrom = (__ur && __ur[from]) || 0;
			const ucFrom = (__uc && __uc[from]) || 0;
			const urTo = (__ur && __ur[to]) || 0;
			const ucTo = (__uc && __uc[to]) || 0;

			let impactFrom = 0;
			let impactTo = 0;

			if (type === "Item Return") {
				impactFrom = -(urFrom - ucFrom) * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (
				type === "Weight Loss - Torching/Cleaning" ||
				type === "Weight Loss - Other"
			) {
				impactFrom = -urFrom * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (type === "Weight Adjustment - Stones") {
				impactFrom = (urFrom - ucFrom) * wt;
				adjustmentImpactMap[from] = (adjustmentImpactMap[from] || 0) + impactFrom;
			} else if (type === "Purity Change") {
				// margin difference moved from => to
				const margin_from = urFrom - ucFrom;
				const margin_to = urTo - ucTo;
				const net = (margin_to - margin_from) * wt;
				// net is positive if moving increases overall margin, negative otherwise.
				// Allocate negative impact on 'from' and positive on 'to'
				impactFrom = -net; // remove margin from 'from' (show as negative)
				impactTo = net; // add margin to 'to'
				adjustmentImpactMap[to] = (adjustmentImpactMap[to] || 0) + impactTo;
			}
		});

		// Iterate receipt rows and update reconciliation table rows
		const rows = container.find(".receipt-table tbody tr[data-idx]");

		// For faster lookup, load recon rows by purity key
		const reconMap = {};
		container.find(".recon-table tbody tr[data-purity]").each((_, r) => {
			const $r = $(r);
			const p = ($r.data("purity") || "").toString().trim();
			if (p) reconMap[p] = $r;
		});

		// --- Ensure all 'to' purities from Purity Blend (Melting) exist in reconciliation table ---
		(this.adjustments || []).forEach((adj) => {
			const type = adj.type;
			if (type === "Purity Blend (Melting)") {
				const fromPurity = (adj.from_purity || "").trim();
				const toPurity = (adj.to_purity || "").trim();
				const addedWeight = parseFloat(adj.weight) || 0;

				if (!toPurity || !addedWeight) return;

				// If this purity doesn't exist yet, create a new row
				if (!reconMap[toPurity]) {
					const $tableBody = container.find(".recon-table tbody");
					const newRow = $(`
				<tr data-purity="${toPurity}">
					<td class="purity-cell">${toPurity}</td>
					<td class="actual-cell">0.00</td>
					<td class="claimed-cell">0.00</td>
					<td class="delta-cell">0.00</td>
					<td class="status-cell"><span class="status-icon warning">&#9888;</span></td>
					<td class="cost-basis">0.00</td>
					<td class="revenue-cell">RM 0.00</td>
					<td class="profit-cell">RM 0.00</td>
					<td class="profit-g-cell">RM 0.00</td>
					<td class="margin-cell">0.0%</td>
				</tr>
			`);
					newRow.attr("data-blend-row", "1");
					$tableBody.append(newRow);
					reconMap[toPurity] = newRow;

					// Copy cost basis and compute per-gram rate
					if (fromPurity && reconMap[fromPurity]) {
						const fromRow = reconMap[fromPurity];

						const fromCostBasis =
							parseFloat(
								fromRow
									.find(".cost-basis")
									.text()
									.replace(/[^\d.-]/g, "")
							) || 0;

						const fromClaimed =
							parseFloat(
								fromRow
									.find(".claimed-cell")
									.text()
									.replace(/[^\d.-]/g, "")
							) || 0;
					}
				}
			}
		});

		// We'll also update any recon rows that have no receipt row (e.g., a 'to' purity that only gets increased)
		// But first update based on receipt rows to get actual weights.
		rows.each((_, rowElem) => {
			const row = $(rowElem);
			const purityVal = (row.find(".input-purity").val() || "").toString().trim();
			const purity = purityVal || "";
			const weight = parseFloat(row.find(".input-weight").val()) || 0;
			const rate = parseFloat(row.find(".input-rate").val()) || 0;
			const amountInput = parseFloat(row.find(".input-amount").val());
			const amount = isNaN(amountInput) ? weight * rate : amountInput;

			if (!purity || !reconMap[purity]) return;

			const reconRow = reconMap[purity];
			let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;

			// Apply adjustments affecting this purity:
			const itemReturnWeight = itemReturnMap[purity] || 0;
			const weightLoss = weightLossMap[purity] || 0;
			const weightAdjustStones = weightAdjustStonesMap[purity] || 0;
			const purityOut = purityChangeOutMap[purity] || 0; // moved out
			const purityIn = purityChangeInMap[purity] || 0; // moved in

			// Effective claimed = baseClaimed - out (item return + purity out + weight loss) + in (purity in + stones adjust)
			const claimed =
				baseClaimed -
				itemReturnWeight -
				weightLoss -
				purityOut +
				purityIn +
				weightAdjustStones;

			// Show strikethrough -> new claimed when it changed
			if (Math.abs(claimed - baseClaimed) > 0.0009) {
				// If claimed decreased show original -> new, likewise for increase
				reconRow
					.find(".claimed-cell")
					.html(`<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`);
			} else {
				reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
			}

			// Actual is the physical weight in Section 1 for this row
			const actual = weight;
			const delta = (actual - claimed).toFixed(2);

			// Cost basis read from UI (existing behavior)
			const baseCostBasis =
				parseFloat(
					reconRow
						.find(".cost-basis")
						.text()
						.replace(/[^\d.-]/g, "")
				) || 0;

			// Compute revenue/profit,
			let revenue = 0,
				profit = 0,
				profitG = 0,
				margin = 0;
			let statusHTML = "";

			// When actual equals claimed and amount equals cost_basis (earlier logic)
			if (Math.abs(actual - claimed) < 0.001 && Math.abs(amount - baseCostBasis) < 0.001) {
				statusHTML = '<span class="status-icon success">&#10004;</span>';
				reconRow.addClass("recon-row-green");
			} else {
				revenue = amount;
				profit = revenue - baseCostBasis;

				// Apply aggregated adjustment impact for this purity (if any)
				const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
				profit += adjImpactForPurity;

				profitG = actual ? profit / actual : 0;
				margin = revenue ? (profit / revenue) * 100 : 0;

				const totalWeightAdjustments =
					itemReturnWeight + weightLoss + purityOut + weightAdjustStones - purityIn;
				// Adjust status logic conservatively: success if positive profit/g or revenue > cost (as before)
				if (
					(profit > 0 && totalWeightAdjustments > 0) ||
					profitG > 0 ||
					revenue > baseCostBasis
				) {
					statusHTML = '<span class="status-icon success">&#10004;</span>';
					reconRow.addClass("recon-row-green");
				} else {
					statusHTML = '<span class="status-icon warning">&#9888;</span>';
					reconRow.removeClass("recon-row-green");
				}
			}

			// Update reconciliation cells
			reconRow.find(".actual-cell").text(actual.toFixed(2));
			reconRow.find(".delta-cell").text(delta);
			reconRow
				.find(".revenue-cell")
				.text(`RM ${revenue.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow
				.find(".profit-cell")
				.text(`RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow
				.find(".profit-g-cell")
				.text(`RM ${profitG.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
			reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
			reconRow.find(".status-cell").html(statusHTML);
		});

		// Additionally, update recon rows that are present in reconciliation table but not linked to a receipt row:
		// (these might be pure 'to' purities that just got increased)
		Object.keys(reconMap).forEach((purity) => {
			// if there is no receipt-row with this purity, still update the claimed to reflect purityChangeInMap
			const reconRow = reconMap[purity];
			const hasReceiptRow = !!container
				.find(`.receipt-table tbody tr[data-idx] .input-purity`)
				.filter(function () {
					return ($(this).val() || "").trim() === purity;
				}).length;

			if (!hasReceiptRow) {
				let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;

				const purityIn = purityChangeInMap[purity] || 0;
				const purityOut = purityChangeOutMap[purity] || 0;
				const itemReturnWeight = itemReturnMap[purity] || 0;
				const weightLoss = weightLossMap[purity] || 0;
				const weightAdjustStones = weightAdjustStonesMap[purity] || 0;

				const claimed =
					baseClaimed -
					itemReturnWeight -
					weightLoss -
					purityOut +
					purityIn +
					weightAdjustStones;

				if (Math.abs(claimed - baseClaimed) > 0.0009) {
					reconRow
						.find(".claimed-cell")
						.html(`<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`);
				} else {
					reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
				}

				// For these, actual remains whatever existing value is (likely 0), so just update claimed and impacts
				const actual = parseFloat(reconRow.find(".actual-cell").text()) || 0;
				const delta = (actual - claimed).toFixed(2);

				let baseCostBasis =
					parseFloat(
						reconRow
							.find(".cost-basis")
							.text()
							.replace(/[^\d.-]/g, "")
					) || 0;

				let revenue = 0,
					profit = 0,
					profitG = 0,
					margin = 0;
				let statusHTML = "";

				const adjImpactForPurity = adjustmentImpactMap[purity] || 0;
				profit = revenue - baseCostBasis + adjImpactForPurity;
				profitG = actual ? profit / actual : 0;
				margin = revenue ? (profit / revenue) * 100 : 0;

				if (profit > 0 || profitG > 0) {
					statusHTML = '<span class="status-icon success">&#10004;</span>';
					reconRow.addClass("recon-row-green");
				} else {
					statusHTML = '<span class="status-icon warning">&#9888;</span>';
					reconRow.removeClass("recon-row-green");
				}

				reconRow.find(".delta-cell").text(delta);
				reconRow
					.find(".profit-cell")
					.text(`RM ${profit.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
				reconRow
					.find(".profit-g-cell")
					.text(`RM ${profitG.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
				reconRow.find(".margin-cell").text(`${margin.toFixed(1)}%`);
				reconRow.find(".status-cell").html(statusHTML);
			}
		});
	}

	bindAdjustmentEvents() {
		const tbody = this.container.find(".section3-adjustments tbody");

		tbody.off("click", ".btn-delete-row").on("click", ".btn-delete-row", (e) => {
			$(e.currentTarget).closest("tr").remove();
			tbody.find("tr").each((i, tr) => {
				$(tr)
					.find("td:first")
					.text(i + 1);
			});
			this.updateReconciliationSummary();
		});

		tbody.off("input.adjust-update").on("input.adjust-update", "input,select", (e) => {
			const $changedRow = $(e.currentTarget).closest("tr");
			// Compute impact only for changed row
			this.computeProfitImpactForRow($changedRow);

			// Update adjustments array fully after change
			this.adjustments = [];
			tbody.find("tr").each((_, tr) => {
				const $tr = $(tr);
				this.adjustments.push({
					type: $tr.find(".adjust-type").val(),
					from_purity: $tr.find(".from-purity").val(),
					to_purity: $tr.find(".to-purity").val(),
					weight: $tr.find(".weight").val(),
					notes: $tr.find(".notes").val(),
					impact: $tr.find(".profit-impact").text(),
				});
			});

			// Update reconciliation summary
			this.updateReconciliationSummary();
		});

		// UPDATED: Add Create Purity button logic here
		tbody.off("change", ".adjust-type").on("change", ".adjust-type", (e) => {
			const row = $(e.currentTarget).closest("tr");
			const selectedType = $(e.currentTarget).val();
			const createPurityBtn = row.find(".btn-create-purity");

			// Show/hide Create Purity button based on selection
			if (selectedType === "Purity Blend (Melting)") {
				createPurityBtn.show();
			} else {
				createPurityBtn.hide();
			}

			this.toggleToPurityField(row);
			this.updateReconciliationSummary();
		});

		tbody.off("input", ".from-purity").on("input", ".from-purity", function () {
			const row = $(this).closest("tr");
			const adjustmentType = row.find(".adjust-type").val();
			if (
				[
					"Weight Loss - Torching/Cleaning",
					"Weight Loss - Other",
					"Weight Adjustment - Stones",
				].includes(adjustmentType)
			) {
				row.find(".to-purity").val($(this).val());
			}
		});
	}

	showCreatePurityDialog() {
		const dialog = new frappe.ui.Dialog({
			title: "Create New Purity",
			fields: [
				{
					label: "Purity Name",
					fieldname: "purity_name",
					fieldtype: "Data",
					reqd: 1,
					description: "Enter purity value (e.g., 916, 999, 750)",
				},
			],
			primary_action_label: "Create",
			primary_action: async (values) => {
				const purityName = values.purity_name.trim();

				if (!purityName) {
					frappe.msgprint("Please enter a purity name");
					return;
				}

				// Check if purity already exists locally
				if (this.availablePurities.includes(purityName)) {
					frappe.msgprint({
						title: "Purity Exists",
						message: `Purity "${purityName}" already exists`,
						indicator: "orange",
					});
					return;
				}

				try {
					// Disable primary button and show loading
					dialog.get_primary_btn().prop("disabled", true).text("Creating...");

					// Call Python API to create purity
					const response = await frappe.call({
						method: "gold_app.api.sales.wholesale_warehouse.create_purity", // Adjust path to your API
						args: {
							purity_name: purityName,
						},
					});

					if (response.message && response.message.status === "success") {
						// Add to local array
						this.availablePurities.push(purityName);
						this.availablePurities.sort(); // Keep sorted

						// Refresh the adjustment section to update datalists
						this.updatePurityDatalistsOnly();

						frappe.show_alert({
							message: `Purity "${purityName}" created successfully`,
							indicator: "green",
						});

						dialog.hide();
					} else {
						throw new Error("Unexpected response from server");
					}
				} catch (error) {
					console.error("Error creating purity:", error);

					let errorMsg = "Unknown error";
					if (error.message) {
						errorMsg = error.message;
					} else if (error._server_messages) {
						try {
							const messages = JSON.parse(error._server_messages);
							errorMsg = messages.map((m) => JSON.parse(m).message).join(", ");
						} catch (e) {
							errorMsg = error._server_messages;
						}
					}

					frappe.msgprint({
						title: "Error",
						message: `Failed to create purity: ${errorMsg}`,
						indicator: "red",
					});

					// Re-enable button and restore label
					dialog.get_primary_btn().prop("disabled", false).text("Create");
				}
			},
		});

		dialog.show();
	}

	updatePurityDatalistsOnly() {
		const section = this.container.find(".section3-adjustments");
		const tbody = section.find("tbody");
		const purities = this.availablePurities;

		// Update each row's datalist options
		tbody.find("tr").each((_, tr) => {
			const $row = $(tr);
			const idx = $row.data("idx");

			// Update "From Purity" datalist
			const fromDatalist = $row.find(`#from-purity-list-${idx}`);
			if (fromDatalist.length) {
				fromDatalist.html(purities.map((p) => `<option value="${p}">`).join(""));
			}

			// Update "To Purity" datalist
			const toDatalist = $row.find(`#to-purity-list-${idx}`);
			if (toDatalist.length) {
				toDatalist.html(purities.map((p) => `<option value="${p}">`).join(""));
			}
		});
	}

	isFullyReconciled() {
		let reconciled = true;
		this.container.find(".recon-table tbody tr").each((_, tr) => {
			const delta = parseFloat($(tr).find(".delta-cell").text());
			const isGreen = $(tr).hasClass("recon-row-green");
			if (Math.abs(delta) > 0.001 || !isGreen) {
				reconciled = false;
				return false; // exit loop early if any row fails
			}
		});
		return reconciled;
	}

	async callCreateSalesAndDeliveryAPI() {
		if (!this.props.customer) {
			throw new Error("Customer info missing.");
		}

		const warehouse = this.props.selected_bag + " - AGSB";
		const items = this.bagSummary.map((line) => {
			const purityStr = line.purity || "";
			return {
				item_code: `Unsorted-${purityStr}`,
				purity: purityStr,
				weight: parseFloat(line.weight) || 0,
				rate: parseFloat(line.rate) || 0,
				warehouse: warehouse,
			};
		});

		const payload = {
			customer: this.props.customer,
			items: JSON.stringify(items),
			company: this.props.company || null,
		};

		console.log("Calling create_sales_invoice API with payload:", payload);

		await new Promise((resolve, reject) => {
			frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.create_sales_invoice",
				args: payload,
				callback: (r) => {
					console.log("API response:", r);
					if (r.message && r.message.status === "success") {
						console.log("API response message full content:", r.message);
						const invoiceRef = r.message.sales_invoice; // or whatever field contains the invoice ref
						if (this.onSalesInvoiceCreated) {
							this.onSalesInvoiceCreated(invoiceRef); // call callback
						}
						resolve(r.message);
					} else {
						reject(new Error("API returned failure"));
					}
				},
				errorHandler: (err) => {
					console.error("API call error:", err);
					reject(err);
				},
			});
		});
	}

	async callCreateMaterialReceiptAPI() {
		try {
			// Collect Purity Blend (Melting) items
			const items = [];
			(this.adjustments || []).forEach((adj) => {
				const type = adj.type;
				if (type === "Purity Blend (Melting)") {
					const toPurity = (adj.to_purity || "").trim();
					const addedWeight = parseFloat(adj.weight) || 0;

					if (!toPurity || !addedWeight) return;

					// Get cost basis and actual weight for this purity
					const row = this.container.find(`.recon-table tr[data-purity='${toPurity}']`);
					const costBasis = parseFloat(row.find(".cost-basis").text()) || 0;
					const actualWeight = parseFloat(row.find(".actual-cell").text()) || 0;

					// Try getting pre-stored per-gram rate
					let basicRate = parseFloat(row.data("per-gram-rate")) || 0;

					// If not found, fallback calculation
					if (!basicRate && actualWeight > 0) {
						basicRate = costBasis / actualWeight;
					}

					items.push({
						purity: toPurity,
						qty: addedWeight,
					});
				}
			});

			console.log("Material Receipt Items:", items);

			if (items.length === 0) {
				console.log("No Purity Blend items found to create stock entry.");
				return;
			}

			// Call backend API to create Stock Entry
			await frappe.call({
				method: "gold_app.api.sales.wholesale_warehouse.create_material_receipt",
				args: { items },
				freeze: true,
				freeze_message: "Creating Material Receipt...",
				callback: (r) => {
					if (r.message) {
						frappe.show_alert({
							message: `Stock Entry Created: ${r.message.stock_entry_name}`,
							indicator: "green",
						});
					}
				},
			});
		} catch (error) {
			console.error("Error creating Material Receipt:", error);
			frappe.msgprint({
				title: "Error",
				message: `Failed to create Material Receipt: ${error.message}`,
				indicator: "red",
			});
		}
	}

	bindUploadReceipt() {
		const container = this.container;
		if (container.find("#hidden-upload-input").length === 0) {
			const fileInput = $(
				'<input type="file" id="hidden-upload-input" style="display:none" />'
			);
			container.append(fileInput);
			fileInput.on("change", (e) => {
				const file = e.target.files[0];
				if (!file) return;
				this.pendingReceiptFile = file; // Save the file object for later
				frappe.show_alert({
					message: `Receipt "${file.name}" selected, will be uploaded on Save.`,
					indicator: "green",
				});
			});
		}
		container
			.find(".btn-upload-receipt")
			.off("click")
			.on("click", () => {
				container.find("#hidden-upload-input").click();
			});
	}

	uploadReceiptFile(transactionName) {
		if (!this.pendingReceiptFile) return;
		const file = this.pendingReceiptFile;
		const reader = new FileReader();
		reader.onload = (ev) => {
			frappe.call({
				method: "frappe.client.attach_file",
				args: {
					doctype: "Wholesale Transaction",
					docname: transactionName, // now the valid docname!
					filedata: ev.target.result.split(",")[1],
					filename: file.name,
					is_private: 1,
				},
				callback: (r) => {
					if (r.message && r.message.file_url) {
						// Update the transaction's upload_receipt field after attaching
						frappe.call({
							method: "frappe.client.set_value",
							args: {
								doctype: "Wholesale Transaction",
								name: transactionName,
								fieldname: "upload_receipt",
								value: r.message.file_url,
							},
							callback: () => {
								frappe.show_alert({
									message: "Receipt file linked successfully!",
									indicator: "green",
								});
							},
						});
					}
				},
			});
		};
		reader.readAsDataURL(file);
	}

	onClickSaveAdjustments() {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Wholesale Transaction",
				filters: { wholesale_bag: this.props.selected_bag },
				fields: ["name"],
			},
			callback: (res) => {
				let transactionDoc = {
					doctype: "Wholesale Transaction",
					wholesale_bag: this.props.selected_bag,
					buyer: this.props.customer,
					buyer_name: this.props.buyer_name || "",
					sale_date: this.props.sale_date,
					total_cost_basis: this.props.totalAmount,
					receipt_lines: this.bagSummary.map((line) => ({
						purity: line.purity,
						weight: line.weight,
						rate: line.rate,
						amount: line.amount,
					})),
					reconciliation_lines: [],
					adjustments: this.adjustments.map((adj) => ({
						adjustment_type: adj.type,
						from_purity: adj.from_purity,
						to_purity: adj.to_purity,
						weight: adj.weight,
						notes: adj.notes,
						profit_impact: adj.impact,
					})),
				};

				this.container.find(".recon-table tbody tr").each((_, tr) => {
					const $tr = $(tr);
					transactionDoc.reconciliation_lines.push({
						purity: $tr.find("td:eq(0)").text().trim(),
						actual: parseFloat($tr.find(".actual-cell").text()) || 0,
						claimed: parseFloat($tr.find(".claimed-cell").text()) || 0,
						delta: parseFloat($tr.find(".delta-cell").text()) || 0,
						status: $tr.find(".status-cell").text().trim() || "",
						cost_basis:
							parseFloat(
								$tr
									.find(".cost-basis")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						revenue:
							parseFloat(
								$tr
									.find(".revenue-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						profit:
							parseFloat(
								$tr
									.find(".profit-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						profit_g:
							parseFloat(
								$tr
									.find(".profit-g-cell")
									.text()
									.replace(/[^\d\.-]/g, "")
							) || 0,
						margin_percent: parseFloat($tr.find(".margin-cell").text()) || 0,
					});
				});

				// 1. Transaction exists: update, then upload
				if (res.message && res.message.length > 0) {
					const docname = res.message[0].name;

					frappe.call({
						method: "frappe.client.get",
						args: { doctype: "Wholesale Transaction", name: docname },
						callback: (r) => {
							if (r.message) {
								Object.assign(r.message, transactionDoc);
								frappe.call({
									method: "frappe.client.save",
									args: { doc: r.message },
									callback: (saveRes) => {
										frappe.show_alert({
											message: "Transaction updated successfully.",
											indicator: "green",
										});
										this.uploadReceiptFile(docname); // <- Always use docname!
									},
									error: (e) => {
										frappe.msgprint("Update failed: " + (e.message || e));
									},
								});
							}
						},
						error: (e) => {
							frappe.msgprint("Failed to fetch latest doc: " + (e.message || e));
						},
					});
				} else {
					// 2. New transaction: insert, then upload receipt
					frappe.call({
						method: "frappe.client.insert",
						args: { doc: transactionDoc },
						callback: (insertRes) => {
							frappe.show_alert({
								message: "Transaction saved successfully.",
								indicator: "green",
							});
							if (insertRes.message && insertRes.message.name) {
								this.uploadReceiptFile(insertRes.message.name); // <- Use the REAL docname!
							}
						},
						error: (e) => {
							frappe.msgprint("Save failed: " + (e.message || e));
						},
					});
				}
			},
			error: (e) => {
				frappe.msgprint("Error searching for transaction: " + (e.message || e));
			},
		});
	}

	// Prfit Impact
	computeUnitMaps() {
		const unit_revenue = {};
		const unit_cost = {};

		// Build unit_revenue from receipt-table rows
		this.container.find(".receipt-table tbody tr[data-idx]").each((_, tr) => {
			const $tr = $(tr);
			const purity = ($tr.find(".input-purity").val() || "").trim();
			const w = parseFloat($tr.find(".input-weight").val()) || 0;
			const a = parseFloat($tr.find(".input-amount").val()) || 0;
			if (purity && w > 0) {
				// If multiple rows for same purity, last one will overwrite; acceptable for simplicity.
				unit_revenue[purity] = a / w;
			}
		});

		// Build unit_cost from reconSummary (use DOM cost-basis cell as source of truth)
		this.container.find(".recon-table tbody tr[data-purity]").each((_, tr) => {
			const $tr = $(tr);
			const purity = $tr.data("purity");
			const claimed =
				parseFloat(
					$tr
						.find(".claimed-cell")
						.text()
						.replace(/[^\d.-]/g, "")
				) || 0;
			const costText = $tr
				.find(".cost-basis")
				.text()
				.replace(/[^\d.-]/g, "");
			const cost = parseFloat(costText) || 0;
			if (purity && claimed > 0) {
				unit_cost[purity] = cost / claimed;
			} else {
				unit_cost[purity] = 0;
			}
		});

		return { unit_revenue, unit_cost };
	}

	computeProfitImpactForRow($row) {
		const type = $row.find(".adjust-type").val();
		const from = ($row.find(".from-purity").val() || "").trim();
		const weight = parseFloat($row.find(".weight").val()) || 0;

		// For Item Return, always show 0
		if (type === "Item Return") {
			$row.find(".profit-impact").text("RM 0.00").removeClass("text-danger text-success");
			return 0;
		}

		// Get current rate (RM/g) for the from_purity
		let currentRate = 0;
		this.container.find(".receipt-table tbody tr[data-idx]").each((_, tr) => {
			const $tr = $(tr);
			const purity = ($tr.find(".input-purity").val() || "").trim();
			if (purity === from) {
				const rowWeight = parseFloat($tr.find(".input-weight").val()) || 0;
				const rowAmount = parseFloat($tr.find(".input-amount").val()) || 0;
				if (rowWeight > 0) {
					currentRate = rowAmount / rowWeight; // RM/g
				}
			}
		});

		// Calculate impact = Rate × Weight
		const impact = currentRate * weight;

		// Update UI cell styling and text
		const $impactCell = $row.find(".profit-impact");

		// Weight Adjustment - Stones shows in GREEN (positive)
		if (type === "Weight Adjustment - Stones") {
			$impactCell
				.text(`+RM ${impact.toFixed(2)}`)
				.removeClass("text-danger")
				.addClass("text-success");
		}
		// All other types show in RED (negative)
		else {
			$impactCell
				.text(`-RM ${impact.toFixed(2)}`)
				.removeClass("text-success")
				.addClass("text-danger");
		}

		// Return signed numeric value (negative for losses, positive for stones)
		return type === "Weight Adjustment - Stones" ? impact : -impact;
	}
}
