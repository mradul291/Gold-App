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
			</div>`;
		this.container.append(html);

		const warehouseList = this.container.find(".warehouse-list");
		const loader = this.container.find(".loader-overlay");

		try {
			let warehouses = await frappe.db.get_list("Warehouse", {
				filters: [
					["warehouse_name", "like", "Bag%"],
					["parent_warehouse", "=", "Wholesale - AGSB"],
				],
				fields: ["name", "warehouse_name"],
			});

			if (!warehouses.length) {
				warehouseList.append(`<p>No warehouse found.</p>`);
				return;
			}

			for (let wh of warehouses) {
				// 🔹 Check if this bag already exists in Wholesale Transaction
				let existingTxn = await frappe.call({
					method: "gold_app.api.sales.wholesale_warehouse.get_wholesale_transaction_by_bag",
					args: { wholesale_bag: wh.warehouse_name },
				});

				let txnData = existingTxn?.message?.data || null;
				let hasBuyer = txnData && txnData.buyer;
				let status = txnData?.status || "Active";
				let isCompleted = status === "Completed";

				let stockData = [];

				// 🔸 If transaction with buyer exists, use its child tables
				if (hasBuyer) {
					const recon = txnData.reconciliation_lines || [];

					stockData = recon.map((r) => ({
						purity: r.purity,
						total_qty: r.actual || 0,
						avg_rate: r.avg_rate || 0,
						total_amount_rm: r.cost_basis || 0,
					}));
				} else {
					const res = await frappe.call({
						method: "gold_app.api.sales.wholesale_warehouse.get_warehouse_stock",
						args: { warehouse_name: wh.name },
					});
					stockData = res?.message || [];
				}

				this.renderWarehouseCard(warehouseList, wh, stockData, txnData, isCompleted);
			}
		} finally {
			loader.fadeOut(200, () => warehouseList.fadeIn(200));
		}
	}

	renderWarehouseCard(container, wh, stockData, txnData, isCompleted) {
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

		if (totalQty === 0) return;

		const formattedTotal = frappe.format(totalAmount, { fieldtype: "Currency" });
		const hasBuyer = txnData && txnData.buyer;

		const card = $(`
	<div class="warehouse-card ${hasBuyer && !isCompleted ? "has-buyer" : ""}">
		<div class="card-header">
			<h3 class="warehouse-title">${wh.warehouse_name}</h3>
			<span class="status-tag">${
				isCompleted ? "Completed" : hasBuyer ? "In Progress" : "Ready for Sale"
			}</span>
		</div>
		<div class="purity-list">${purityList}</div>
		<div class="summary-block">
			<div class="summary-row"><span>Total:</span><span>${totalQty} g</span></div>
			<div class="summary-row"><span>Cost:</span><span>${formattedTotal}</span></div>
			${
				hasBuyer && !isCompleted
					? `<div class="summary-row buyer-row"><span>Buyer:</span><span>${
							txnData.buyer_name || txnData.buyer
					  }</span></div>`
					: ""
			}
		</div>
		<button class="select-btn">${
			isCompleted ? "Select This Bag" : hasBuyer ? "Resume Transaction" : "Select This Bag"
		}</button>
	</div>
`);

		card.find(".select-btn").on("click", () => {
			if (hasBuyer && !isCompleted) {
				this.nextStepCallback({
					warehouse_id: wh.name,
					warehouse_name: wh.warehouse_name,
					existing_txn: txnData,
				});
			} else {
				this.nextStepCallback({
					warehouse_id: wh.name,
					warehouse_name: wh.warehouse_name,
				});
			}
		});

		container.append(card);
	}
}
