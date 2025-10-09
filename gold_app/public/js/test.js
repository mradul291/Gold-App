frappe.pages["manager-pickup"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Manager Pickup",
		single_column: true,
	});
	new ManagerPickupPage(wrapper);
};

class ManagerPickupPage {
	constructor(wrapper) {
		this.wrapper = wrapper;
		this.page = wrapper.page;
		this.container = null;
		this.current_dealer = null;
		this.changes = {};
		this.setup();
	}

	setup() {
		this.make_toolbar();
		this.make_container();
		this.show_summary();
	}

	make_toolbar() {
		this.page.set_primary_action(__("Refresh"), () => this.show_summary());
		this.page.set_secondary_action(__("Save"), () => this.save_changes());
		this.page.clear_menu();
	}

	make_container() {
		this.container = $('<div class="manager-pickup-container"></div>').appendTo(this.wrapper);
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

	async show_summary() {
		this.container.empty();

		let items = [];
		try {
			items = await frappe.xcall("gold_app.api.page_api.get_manager_pickup_items", {
				is_pickup: 1,
			});
		} catch (err) {
			console.error(err);
			this.container.html('<div class="alert alert-danger">Failed to load data</div>');
			return;
		}

		if (!items.length) {
			this.container.html('<div class="alert alert-info">No pickup items found</div>');
			return;
		}

		const grouped = {};
		items.forEach((i) => {
			if (!grouped[i.dealer]) {
				grouped[i.dealer] = {
					dealer: i.dealer,
					purities: new Set(),
					total_weight: 0,
					items: [],
				};
			}
			grouped[i.dealer].purities.add(i.purity);
			grouped[i.dealer].total_weight += i.total_weight || 0;
			grouped[i.dealer].items.push(i);
		});

		const $tbl = $(`
            <table class="table table-sm table-bordered">
                <thead>
                    <tr>
                         <th style="width:110px; text-align:center;">
                    <span class="toggle-all" 
                          style="cursor:pointer; color:#007bff; text-decoration:underline; user-select:none; text-transform:none;">
                        Expand All
                    </span>
                </th>
				 <th style="width:36px; text-align:center;">
            <input type="checkbox" id="select-all-dealers" title="Tick if all ok" />
        </th>
                        <th>Customer Name</th>
                        <th>Purities</th>
                        <th>Total Weight (g)</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `).appendTo(this.container);

		const $tbody = $tbl.find("tbody");
		const $toggleAll = $tbl.find(".toggle-all");

		// --- Place the master "select-all-dealers" handler HERE ---
		$("#select-all-dealers").on("change", async (e) => {
			const allChecked = $(e.currentTarget).is(":checked");

			$(".dealer-tick-all-ok").prop("checked", allChecked);

			for (const row of $tbody.find("tr[data-dealer]")) {
				const $row = $(row);
				const dealerName = $row.data("dealer");
				const group = grouped[dealerName];

				group.items.forEach((item) => {
					this.track_change(item.name, { tick_all_ok: allChecked ? 1 : 0 });
				});

				if ($row.next().hasClass("detail-row")) {
					$row.next().find(".tick-all-ok").prop("checked", allChecked);
				}
			}

			frappe.show_alert({
				message: allChecked ? "All dealers ticked" : "All dealers unticked",
				indicator: allChecked ? "green" : "orange",
			});
		});

		$toggleAll.on("click", async () => {
			const isExpand = $toggleAll.text() === "Expand All";
			$toggleAll.text(isExpand ? "Collapse All" : "Expand All");

			const $rows = $tbody.find("tr[data-dealer]");
			for (const row of $rows) {
				const $tr = $(row);
				const $icon = $tr.find(".toggle-cell i");

				if (isExpand) {
					// Expand all dealers
					if (!$tr.next().hasClass("detail-row")) {
						await this.show_detail(grouped[$tr.data("dealer")].items, $tr);
					} else if (!$tr.next().is(":visible")) {
						$tr.next().show();
					}
					$icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
				} else {
					// Collapse all dealers
					if ($tr.next().hasClass("detail-row") && $tr.next().is(":visible")) {
						$tr.next().hide();
					}
					$icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
				}
			}
		});

		Object.values(grouped).forEach((group) => {
			const $tr = $(`
                <tr data-dealer="${group.dealer}">
                    <td class="toggle-cell" style="cursor:pointer;text-align:center;">
                        <i class="fa fa-chevron-right"></i>
                    </td>
					 <td style="text-align:center;">
        				<input type="checkbox" class="dealer-tick-all-ok" />
    				</td>
                    <td>${
						group.items[0].dealer_name
							? group.items[0].dealer_name + " - " + group.dealer
							: group.dealer
					}</td>
                    <td>${Array.from(group.purities).join(", ")}</td>
                    <td>${group.total_weight.toFixed(2)}</td>
                </tr>
            `).appendTo($tbody);

			$tr.find(".toggle-cell").on("click", async () => {
				this.current_dealer = group.dealer;
				await this.show_detail(group.items, $tr);
			});

			// Parent table tick-all for a dealer
			$tr.find(".dealer-tick-all-ok").on("change", async (e) => {
				const checked = e.target.checked;

				// Track for all items in that dealer
				group.items.forEach((item) => {
					this.track_change(item.name, { tick_all_ok: checked ? 1 : 0 });
				});

				const $detailRow = $tr.next(".detail-row");
				const $container = $detailRow.find(".transactions-container");

				if (checked) {
					// If detail row not loaded/expanded, load transactions quietly
					if ($container.length && !$container.data("loaded")) {
						try {
							await this.render_transactions($container, group.items);
							$container.data("loaded", true);
						} catch (err) {
							console.warn(
								`Failed to load transactions for dealer ${group.dealer}`,
								err
							);
						}
					}

					// Select all inner transactions
					if ($container.length && $container.data("loaded")) {
						$container.find(".tick-all-ok").each(function () {
							$(this).prop("checked", true).trigger("change");
						});
					}
				} else {
					// Uncheck all inner transactions if loaded
					if ($container.length && $container.data("loaded")) {
						$container.find(".tick-all-ok").each(function () {
							$(this).prop("checked", false).trigger("change");
						});
					}
				}

				// If detail row is already expanded, also update visible checkboxes
				if ($detailRow.length && $detailRow.is(":visible")) {
					$detailRow.find(".tick-all-ok").prop("checked", checked);
				}
			});
		});
	}

	async show_detail(items, $row) {
		if ($row.next().hasClass("detail-row")) {
			$row.next().toggle();
			const icon = $row.find(".toggle-cell i");
			icon.toggleClass("fa-chevron-right fa-chevron-down");
			return;
		}

		const $detailRow = $(`
            <tr class="detail-row">
                <td colspan="5">
                    <table class="table table-sm table-bordered">
                        <thead>
                            <tr>
                               <th style="width:90px;">Date</th>
                                <th>Purity</th>
                                <th>Total Weight (g)</th>
                                 <th>Discrepancy (MYR)</th>
								 <th>Discrepancy Note</th>
                                <th>Amount</th>
                                <th style="text-align:center;">Tick if ok</th>
                                <th style="width:180px;">Any discrepancies?</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </td>
            </tr>
        `).insertAfter($row);

		const $tbody = $detailRow.find("tbody");

		items.forEach((i) => {
			const dstr = i.date ? this.formatCustomDate(i.date) : "";
			const checked = i.tick_all_ok ? "checked" : "";
			const discrepancyOptions = `
                <option value="">Select</option>
                <option value="Refund Request (ie. Credit Note)" ${
					i.discrepancy_action === "Refund Request (ie. Credit Note)" ? "selected" : ""
				}>
                    Refund Request (ie. Credit Note)
                </option>
            `;
			const $tr = $(`
<tr data-name="${i.name}">
    <td>${dstr}</td> 
    <td>${i.purity}</td> 
    <td>${(i.total_weight || 0).toFixed(2)}</td> 
    <td>${frappe.format(i.discrepancy_amount || 0, { fieldtype: "Currency" })}</td> 
    <td>${i.discrepancy_note || ""}</td> 
    <td>${frappe.format(i.amount || 0, { fieldtype: "Currency" })}</td> 
    <td style="text-align:center;">
        <input type="checkbox" class="tick-all-ok" ${i.tick_all_ok ? "checked" : ""} />
    </td> 
   <td style="text-align:center;">
    <button class="btn btn-sm btn-info refund-request-btn" 
            style="padding:2px 6px; font-size:0.75rem;">
        Refund Request
    </button>
</td>

</tr>
`).appendTo($tbody);

			$tr.find(".tick-all-ok").on("change", (e) => {
				this.track_change(i.name, { tick_all_ok: e.target.checked ? 1 : 0 });
			});

			$tr.find(".refund-request-btn").on("click", async () => {
				await frappe.prompt(
					[
						{
							fieldname: "discrepancy_amount",
							label: "Discrepancy Amount (MYR)",
							fieldtype: "Float",
							reqd: 1,
						},
						{
							fieldname: "discrepancy_note",
							label: "Discrepancy Note",
							fieldtype: "Data",
							reqd: 0,
						},
					],
					(values) => {
						// Track changes in JS
						this.track_change(i.name, {
							discrepancy_action: "Refund Request (ie. Credit Note)",
							discrepancy_amount: values.discrepancy_amount,
							discrepancy_note: values.discrepancy_note,
						});

						// Update table cells immediately
						$tr.find("td").eq(3).text(values.discrepancy_amount.toFixed(2)); // Discrepancy Amount
						$tr.find("td")
							.eq(4)
							.text(values.discrepancy_note || ""); // Discrepancy Note
					},
					__("Enter Discrepancy Details"),
					__("OK")
				);
			});
		});

		$row.find(".toggle-cell i").removeClass("fa-chevron-right").addClass("fa-chevron-down");
	}

	track_change(name, update) {
		if (!this.changes[name]) {
			this.changes[name] = { name };
		}
		Object.assign(this.changes[name], update);
		this.page.set_indicator(__("Not Saved"), "orange");
	}

	async save_changes() {
		const updates = Object.values(this.changes);
		if (!updates.length) {
			frappe.show_alert({ message: __("No changes to save"), indicator: "blue" });
			return;
		}

		try {
			const result = await frappe.xcall("gold_app.api.page_api.manager_bulk_update_pickup", {
				doc_updates: updates,
			});

			// Show success
			frappe.show_alert({
				message: __(`${result.updated} records updated`),
				indicator: "green",
			});
			this.page.clear_indicator();

			const selected_pickups = Object.keys(this.changes)
				.filter((name) => this.changes[name].tick_all_ok)
				.map((name) => name);

			if (selected_pickups.length) {
				let res = await frappe.xcall("gold_app.api.page_api.create_manager_pool", {
					pickup_names: selected_pickups,
					pool_type: "Dealer",
					notes: "Auto-created from Manager Pickup Page",
				});

				frappe.msgprint({
					title: __("Pool Created"),
					message: `New Pool <a href="/app/gold-pool/${res.pool_name}" target="_blank">${
						res.pool_name
					}</a> created.<br>
                          <b>Total Weight:</b> ${res.total_weight.toFixed(2)} g`,
					indicator: "green",
				});
			}

			this.changes = {};
			await this.show_summary();
		} catch (err) {
			console.error(err);
			frappe.msgprint("Failed to save changes");
		}
	}
}
