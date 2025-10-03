frappe.pages["retail-pool-creation"].on_page_load = function (wrapper) {
	new GoldSortingPage(wrapper);
};

class GoldSortingPage {
	constructor(wrapper) {
		this.wrapper = wrapper;
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: "Retail Pool Creation",
			single_column: true,
		});

		this.selected = new Set();
		this.all_rows = [];
		this.render();
	}

	formatCustomDate(dateStr) {
		if (!dateStr) return "";
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}

	async render() {
		$(this.wrapper).find(".layout-main-section").empty();

		this.container = $(`
            <div class="gold-sorting-container">
                <div class="header-actions mb-3" style="text-align: right;">
    				<button class="btn btn-sm create-pool-btn" style="background-color: #000; color: #fff; border: none;" disabled>
        				<i class="fa fa-layer-group me-1"></i> Review & Create Pool
    				</button>
				</div>

                <div class="table-wrapper">
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead>
                                <tr>
                                    <th style="width:40px;"></th>
									<th style="width:60px;" class="text-center">
                                        <input type="checkbox" class="select-all" />
                                    </th>
                                    <th>Purchase Receipt</th>
                                    <th>Purities</th>
                                    <th class="text-end">Total Weight (g)</th>
                                    <th class="text-end">Total Amount (MYR)</th>
                                    
                                </tr>
                            </thead>
                            <tbody></tbody>
                            <tfoot>
                                <tr class="summary-row">
                                    <td colspan="3" class="text-end fw-bold">TOTAL</td>
                                    <td class="text-end total-weight">0.00</td>
                                    <td></td>
                                    <td class="text-end total-amount">0.00</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `).appendTo(this.wrapper);

		this.bind_events();
		await this.load_pickups();
	}

	bind_events() {
		this.container.find(".create-pool-btn").on("click", async () => {
			if (this.selected.size === 0) {
				frappe.msgprint(__("Please select at least one pickup."));
				return;
			}
			await this.show_pool_summary();
		});

		this.container.find(".select-all").on("change", (e) => {
			const is_checked = e.target.checked;

			this.container.find(".pickup-select").each((i, el) => {
				el.checked = is_checked;
				const row_name = $(el).closest("tr").data("name");
				if (is_checked) {
					this.selected.add(row_name);
				} else {
					this.selected.delete(row_name);
				}
			});

			this.update_totals(this.all_rows);
		});
	}

	async load_pickups() {
		const tbody = this.container.find("tbody");
		tbody.html('<tr><td colspan="7" class="text-center text-muted py-3">Loading...</td></tr>');

		try {
			const r = await frappe.call({
				method: "gold_app.api.pooling.get_unpooled_pickups",
				args: { pool_type: "Dealer" }, // pool_type param kept for compatibility
			});

			this.all_rows = r.message || [];
			tbody.empty();

			if (!this.all_rows.length) {
				tbody.html(
					'<tr><td colspan="7" class="text-center text-muted py-3">No unpooled pickups found.</td></tr>'
				);
				return;
			}

			// 🔹 Group by Purchase Receipt
			const grouped = {};
			this.all_rows.forEach((row) => {
				if (!grouped[row.purchase_receipt]) {
					grouped[row.purchase_receipt] = {
						pr: row.purchase_receipt,
						purities: new Set(),
						total_weight: 0,
						total_amount: 0,
						items: [],
					};
				}
				grouped[row.purchase_receipt].purities.add(row.purity);
				grouped[row.purchase_receipt].total_weight += row.total_weight || 0;
				grouped[row.purchase_receipt].total_amount += row.amount || 0;
				grouped[row.purchase_receipt].items.push(row);
			});

			// 🔹 Render Purchase Receipt summary rows
			Object.values(grouped).forEach((group) => {
				const avg_cost = group.total_weight ? group.total_amount / group.total_weight : 0;

				const $tr = $(`
                    <tr class="pr-row" data-pr="${group.pr}">
                        <td class="toggle-cell text-center" style="cursor:pointer;">
                            <i class="fa fa-chevron-right"></i>
                        </td>
						<td class="text-center">
                            <input type="checkbox" class="pr-select" />
                        </td>
                        <td>${group.pr || ""}</td>
                        <td>${Array.from(group.purities).join(", ")}</td>
                        <td class="text-end">${group.total_weight.toFixed(2)}</td>
                        <td class="text-end">${group.total_amount.toFixed(2)}</td>
                        
                    </tr>
                `).appendTo(tbody);

				// Toggle details
				$tr.find(".toggle-cell").on("click", async () => {
					await this.show_detail(group.items, $tr);
				});

				// PR select-all
				$tr.find(".pr-select").on("change", (e) => {
					const checked = e.target.checked;
					group.items.forEach((item) => {
						if (checked) {
							this.selected.add(item.name);
						} else {
							this.selected.delete(item.name);
						}
					});
					if ($tr.next().hasClass("detail-row")) {
						$tr.next().find(".pickup-select").prop("checked", checked);
					}
					this.update_totals(this.all_rows);
				});
			});
		} catch (e) {
			console.error(e);
			tbody.html(
				'<tr><td colspan="7" class="text-center text-danger py-3">Failed to load pickups.</td></tr>'
			);
		}
	}

	async show_detail(items, $row) {
		// Toggle if already open
		if ($row.next().hasClass("detail-row")) {
			$row.next().toggle();
			$row.find(".toggle-cell i").toggleClass("fa-chevron-right fa-chevron-down");
			return;
		}

		const $detailRow = $(`
            <tr class="detail-row">
                <td colspan="7">
                    <table class="table table-sm table-bordered">
                        <thead>
                            <tr>
                                <th style="width:40px;" class="text-center"></th>
                                <th>Date</th>
                                <th>Dealer</th>
                                <th>Purity</th>
                                <th class="text-end">Weight (g)</th>
                                <th class="text-end">Amount (MYR)</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </td>
            </tr>
        `).insertAfter($row);

		const $tbody = $detailRow.find("tbody");

		items.forEach((row) => {
			const $tr = $(`
                <tr data-name="${row.name}">
                    <td class="text-center">
                        <input type="checkbox" class="pickup-select" ${
							this.selected.has(row.name) ? "checked" : ""
						}/>
                    </td>
                    <td>${this.formatCustomDate(row.date) || ""}</td>
                    <td>${row.dealer || ""}</td>
                    <td><span class="badge bg-light text-dark">${row.purity || ""}</span></td>
                    <td class="text-end">${(row.total_weight || 0).toFixed(2)}</td>
                    <td class="text-end">${(row.amount || 0).toFixed(2)}</td>
                </tr>
            `).appendTo($tbody);

			$tr.find(".pickup-select").on("change", (e) => {
				if (e.target.checked) {
					this.selected.add(row.name);
				} else {
					this.selected.delete(row.name);
				}
				this.update_totals(this.all_rows);
			});
		});

		$row.find(".toggle-cell i").removeClass("fa-chevron-right").addClass("fa-chevron-down");
	}

	update_totals(all_rows) {
		let total_weight = 0;
		let total_amount = 0;

		all_rows.forEach((row) => {
			if (this.selected.has(row.name)) {
				total_weight += row.total_weight || 0;
				total_amount += row.amount || 0;
			}
		});

		this.container.find(".total-weight").text(total_weight.toFixed(2));
		this.container.find(".total-amount").text(total_amount.toFixed(2));

		this.container.find(".create-pool-btn").prop("disabled", this.selected.size === 0);
	}

	async show_pool_summary() {
		try {
			const r = await frappe.call({
				method: "gold_app.api.pooling.get_pool_summary",
				args: { pickup_names: Array.from(this.selected) },
			});

			if (!r.message) {
				frappe.msgprint(__("Could not compute pool summary."));
				return;
			}

			const summary = r.message;
			let purity_html = "";
			for (let purity in summary.totals_by_purity) {
				purity_html += `
                    <tr>
                        <td>${purity}</td>
                        <td class="text-end">${summary.totals_by_purity[purity].toFixed(2)} g</td>
                        <td class="text-end">RM ${summary.cost_by_purity[purity].toFixed(2)}</td>
                        <td class="text-end">RM ${summary.avco_by_purity[purity].toFixed(2)}/g</td>
                    </tr>
                `;
			}

			const d = new frappe.ui.Dialog({
				title: __("Pool Creation Summary"),
				fields: [
					{
						fieldtype: "HTML",
						fieldname: "summary_html",
						options: `
                            <div class="mb-3">
                                <strong>Selected Transactions:</strong> ${summary.count} receipts
                            </div>
                            <table class="table table-sm table-bordered">
                                <thead>
                                    <tr>
                                        <th>Purity</th>
                                        <th class="text-end">Weight</th>
                                        <th class="text-end">Total Cost</th>
                                        <th class="text-end">AVCO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${purity_html}
                                </tbody>
                                <tfoot>
                                    <tr class="table-info">
                                        <td class="fw-bold">TOTAL</td>
                                        <td class="text-end fw-bold">${summary.total_weight.toFixed(
											2
										)} g</td>
                                        <td class="text-end fw-bold">RM ${summary.total_value.toFixed(
											2
										)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        `,
					},
				],
				primary_action_label: __("Create Pool"),
				primary_action: async () => {
					await this.create_pool();
					d.hide();
				},
			});

			d.show();
		} catch (e) {
			console.error(e);
			frappe.msgprint(__("Failed to fetch pool summary."));
		}
	}

	async create_pool() {
		const btn = this.container.find(".create-pool-btn");
		btn.prop("disabled", true).text("Creating...");

		try {
			const r = await frappe.call({
				method: "gold_app.api.pooling.create_pool",
				args: {
					pickup_names: Array.from(this.selected),
					pool_type: "Branch",
				},
			});

			if (r.message) {
				frappe.show_alert({ message: __("Pool Created"), indicator: "green" });

				setTimeout(() => {
					window.location.reload();
				}, 500);
			}
		} catch (e) {
			console.error(e);
			frappe.msgprint(__("Failed to create pool."));
			btn.prop("disabled", false).text("Review & Create Pool");
		}
	}
}
