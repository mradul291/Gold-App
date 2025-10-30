class Step1SelectBag {
	constructor(container, nextStepCallback) {
		this.container = container;
		this.nextStepCallback = nextStepCallback;
		this.render();
	}

	async render() {
		const html = `
		<div class="wholesale-container">
			<div class="loader-overlay">
				<div class="loader"></div>
				<p>Loading bags, please wait...</p>
			</div>
			<div class="warehouse-list flex flex-wrap gap-6" style="display:none;"></div>
		</div>
	`;
		this.container.append(html);

		const warehouseList = this.container.find(".warehouse-list");
		const loader = this.container.find(".loader-overlay");

		try {
			let warehouses = await frappe.db.get_list("Warehouse", {
				filters: [
					["warehouse_name", "like", "Bag%"],
					["parent_warehouse", "=", "Wholesale - AGSB"],
				],
				fields: ["name", "warehouse_name", "parent_warehouse"],
			});

			if (!warehouses.length) {
				warehouseList.append(`<p>No warehouse found.</p>`);
				return;
			}

			for (let wh of warehouses) {
				const res = await frappe.call({
					method: "gold_app.api.sales.wholesale_warehouse.get_warehouse_stock",
					args: { warehouse_name: wh.name },
				});
				const stockData = res && res.message ? res.message : [];
				this.renderWarehouseCard(warehouseList, wh, stockData);
			}
		} finally {
			// Hide loader and show results
			loader.fadeOut(200, () => {
				warehouseList.fadeIn(200);
			});
		}
	}

	renderWarehouseCard(container, wh, stockData) {
		const warehouse_name = wh.warehouse_name;

		let purityList = "";
		let totalQty = 0;
		let totalAmount = 0;

		(stockData || []).forEach((row) => {
			const formattedAmount = `RM ${parseFloat(row.total_amount_rm).toFixed(2)}`;
			const avgRate = parseFloat(row.avg_rate).toFixed(2);
			purityList += `
				<div class="purity-line">
					<span class="purity-left">${row.purity}:</span>
					<span class="purity-right">${row.total_qty} g @ RM ${avgRate}/g = ${formattedAmount}</span>
				</div>`;
			totalQty += row.total_qty;
			totalAmount += row.total_amount_rm;
		});

		// Skip this card if totalQty is 0 (no weight)
		if (totalQty === 0) {
			return; // Do not render this warehouse card
		}

		const formattedTotal = frappe.format(totalAmount, { fieldtype: "Currency" });

		const card = $(`
			<div class="warehouse-card">
				<div class="card-header">
					<h3 class="warehouse-title">${warehouse_name}</h3>
					<span class="status-tag">Ready for Sale</span>
				</div>

				<div class="purity-list">${purityList}</div>

				<div class="summary-block">
					<div class="summary-row">
						<span class="summary-label">Total:</span>
						<span class="summary-value">${totalQty} g</span>
					</div>
					<div class="summary-row">
						<span class="summary-label cost-label">Cost:</span>
						<span class="summary-value cost-value">${formattedTotal}</span>
					</div>
				</div>

				<button class="select-btn">Select This Bag</button>
			</div>
		`);

		card.find(".select-btn").on("click", () => {
			this.nextStepCallback({
				warehouse_id: wh.name, // internal ID
				warehouse_name: warehouse_name, // display name
			});
		});
		container.append(card);
	}
}
