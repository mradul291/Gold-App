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

		this.render();
		this.bindReceiptEvents();
		this.bindUploadReceipt();
		this.renderAdjustmentsSection();
		this.attachNavHandlers();
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
		const purities = this.getPuritiesFromReconciliation();
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
                    <select class="input-purity">${purityOptions(r.purity)}</select>
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
		const purities = this.getPuritiesFromReconciliation(); // get fresh purity list
		const purityOptions = [
			`<option value="" disabled selected>Select</option>`, // Blank first option
			...purities.map((p) => `<option value="${p}">${p}</option>`), // rest
		].join("");

		const addRow = () => {
			const idx = tbody.children().length + 1;
			const optionHTML = adjustmentOptions
				.map((o) => `<option value="${o}">${o}</option>`)
				.join("");

			const row = $(`
                <tr data-idx="${idx}">
                    <td>${idx}</td>
                    <td><select class="adjust-type">${optionHTML}</select></td>
                    <td><select class="from-purity">${purityOptions}</select></td>
            		<td><select class="to-purity">${purityOptions}</select></td>
                    <td><input type="number" class="weight" placeholder="0" /></td>
                    <td><input type="text" class="notes" placeholder="Enter notes or remarks..." /></td>
                    <td class="profit-impact text-success">+RM 0.00</td>
                    <td><button class="btn-delete-row" title="Remove">🗑️</button></td>
                </tr>
            `);
			tbody.append(row);
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
				const purities = this.getPuritiesFromReconciliation();
				const purityOptions = [
					`<option value="" disabled selected>Select</option>`, // Blank first option
					...purities.map((p) => `<option value="${p}">${p}</option>`), // rest
				].join("");

				const row = $(`
        <tr data-idx="${idx}">
            <td>${idx}</td>
            <td><select class="adjust-type">${optionHTML}</select></td>
            <td><select class="from-purity">${purityOptions}</select></td>
            <td><select class="to-purity">${purityOptions}</select></td>
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
		tbody.off("input.adjust-update").on("input.adjust-update", "input,select", () => {
			// Sync adjustments array with current UI state
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
			// Refresh the reconciliation summary to immediately apply changes
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
			this.bagSummary.splice(idx, 1);
			this.renderAndBindAll();
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

		// Precompute total Item Return weights per purity from adjustments
		const itemReturnMap = {};
		this.adjustments.forEach((adj) => {
			if (adj.type === "Item Return") {
				const purity = adj.from_purity;
				const weight = parseFloat(adj.weight) || 0;
				if (!itemReturnMap[purity]) {
					itemReturnMap[purity] = 0;
				}
				itemReturnMap[purity] += weight;
			}
		});

		// Precompute total Weight Loss - Torching/Cleaning weights per purity from adjustments
		const weightLossMap = {};
		this.adjustments.forEach((adj) => {
			if (
				adj.type === "Weight Loss - Torching/Cleaning" ||
				adj.type === "Weight Loss - Other"
			) {
				const purity = adj.from_purity;
				const weight = parseFloat(adj.weight) || 0;
				if (!weightLossMap[purity]) {
					weightLossMap[purity] = 0;
				}
				weightLossMap[purity] += weight;
			}
		});

		// New weight adjustment (addition) map
		const weightAdjustStonesMap = {};
		this.adjustments.forEach((adj) => {
			if (adj.type === "Weight Adjustment - Stones") {
				const purity = adj.from_purity;
				const weight = parseFloat(adj.weight) || 0;
				if (!weightAdjustStonesMap[purity]) {
					weightAdjustStonesMap[purity] = 0;
				}
				weightAdjustStonesMap[purity] += weight;
			}
		});

		const rows = container.find(".receipt-table tbody tr[data-idx]");

		rows.each((_, rowElem) => {
			const row = $(rowElem);
			const purity = row.find(".input-purity").val().trim();
			const weight = parseFloat(row.find(".input-weight").val()) || 0;
			const rate = parseFloat(row.find(".input-rate").val()) || 0;
			const amountInput = parseFloat(row.find(".input-amount").val());
			const amount = isNaN(amountInput) ? weight * rate : amountInput;

			// Find matching row in reconciliation table via data-purity attribute
			const reconRow = container.find(`.recon-table tr[data-purity="${purity}"]`);
			if (!reconRow.length) return;

			let baseClaimed = parseFloat(reconRow.find(".claimed-cell").text()) || 0;
			let itemReturnWeight = itemReturnMap[purity] || 0;
			let weightLoss = weightLossMap[purity] || 0;
			let weightAdjustStones = weightAdjustStonesMap[purity] || 0;
			let totalAdjustment = itemReturnWeight + weightLoss;
			let claimed = baseClaimed - itemReturnWeight - weightLoss + weightAdjustStones;

			if (Math.abs(claimed - baseClaimed) > 0.001) {
				reconRow
					.find(".claimed-cell")
					.html(`<s>${baseClaimed.toFixed(2)}</s> &rarr; ${claimed.toFixed(2)}`);
			} else {
				reconRow.find(".claimed-cell").text(baseClaimed.toFixed(2));
			}

			const baseCostBasis =
				parseFloat(
					reconRow
						.find(".cost-basis")
						.text()
						.replace(/[^\d.-]/g, "")
				) || 0;

			// Apply Item Return adjustment weights to claimed weight

			// New actual after adjustment:
			// Assuming 'actual' is what physically remains (claimed - item return)
			const actual = weight;

			const delta = (actual - claimed).toFixed(2);

			// Update profit, margin calculations as before
			let revenue = 0,
				profit = 0,
				profitG = 0,
				margin = 0;
			let statusHTML = "";

			if (Math.abs(actual - claimed) < 0.001 && Math.abs(amount - baseCostBasis) < 0.001) {
				statusHTML = '<span class="status-icon success">&#10004;</span>';
				reconRow.addClass("recon-row-green");
			} else {
				revenue = amount;
				profit = revenue - baseCostBasis;
				profitG = actual ? profit / actual : 0;
				margin = revenue ? (profit / revenue) * 100 : 0;

				const totalWeightAdjustments = itemReturnWeight + weightLoss + weightAdjustStones;

				if (profit > 0 && totalWeightAdjustments > 0) {
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

	getPuritiesFromReconciliation() {
		const purities = [];
		this.container.find(".section2-recon-summary table.recon-table tbody tr").each((_, tr) => {
			const purity = $(tr).find("td:first").text().trim();
			if (purity && !purities.includes(purity)) {
				purities.push(purity);
			}
		});
		return purities;
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
}
