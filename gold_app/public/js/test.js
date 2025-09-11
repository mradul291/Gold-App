frappe.pages["pickup-items"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Pickup Items",
		single_column: true,
	});
	new PickupItemsPage(wrapper);
};

class PickupItemsPage {
	constructor(wrapper) {
		this.wrapper = wrapper;
		this.page = wrapper.page;
		this.selected = new Set();
		this.current_dealer = null;
		this.only_nonpickup = false;
		this.setup();
	}

	setup() {
		this.page.set_title(__("Pickup Items"));
		this.make_toolbar();
		this.make_filters();
		this.make_container();
		this.show_overview();
		this.show_dealer_summary();
	}

	make_toolbar() {
		this.page.set_primary_action(__("Mark Pickup"), () => this.change_selected_pickup(true));
		this.page.add_action_item(__("Refresh"), () => this.refresh());
		this.page.add_action_item(__("Assign To"), () => this.assign_selected_to());
	}

	make_filters() {}

	make_container() {
		this.container = $('<div class="pickup-items-container"></div>').appendTo(this.wrapper);
		this.overview_container = $('<div class="pickup-overview-container mb-4"></div>').appendTo(
			this.container
		);

		this.summary_container = $('<div class="pickup-summary-container"></div>').appendTo(
			this.container
		);
	}

	async show_overview(selectedDealer = null) {
		this.overview_container.empty();

		let overview_data = {};
		try {
			overview_data = await frappe.xcall(
				"gold_app.api.page_api.get_pending_pickup_overview",
				{
					dealer: selectedDealer,
				}
			);
		} catch (err) {
			console.error(err);
			this.overview_container.html(
				'<div class="alert alert-danger">Failed to load overview</div>'
			);
			return;
		}

		if (!overview_data || (!overview_data.total && !overview_data.selected)) {
			this.overview_container.html(
				'<div class="alert alert-info">No overview data found</div>'
			);
			return;
		}

		// Build table HTML
		const $tbl = $(`
        <table class="table table-sm table-bordered">
            <thead>
                <tr>
                    <th colspan="8" class="text-center" style="text-align:center">Pending Pick-up Items Overview</th>
                </tr>
                <tr>
                    <th colspan="4" class="text-center">Total Overview</th>
                    <th colspan="4" class="text-center">Selected Dealer Overview</th>
                </tr>
                <tr>
                    <th>Purity</th>
                    <th>Weight (g)</th>
                    <th>Avco (RM/g)</th>
                    <th>Amount (RM)</th>
                    <th>Purity</th>
                    <th>Weight (g)</th>
                    <th>Avco (RM/g)</th>
                    <th>Amount (RM)</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `).appendTo(this.overview_container);

		const $tbody = $tbl.find("tbody");

		// Combine purities from both total and selected dealer
		const purities = new Set([
			...Object.keys(overview_data.total || {}),
			...Object.keys(overview_data.selected || {}),
		]);

		purities.forEach((purity) => {
			const total = overview_data.total?.[purity] || {};
			const selected = overview_data.selected?.[purity] || {};
			$tbody.append(`
            <tr>
                <td>${purity}</td>
                <td>${(total.weight || 0).toFixed(2)}</td>
                <td>${total.avco ? "RM" + total.avco.toFixed(2) : ""}</td>
                <td>${total.amount ? "RM" + total.amount.toLocaleString() : ""}</td>
                <td>${purity}</td>
                <td>${(selected.weight || 0).toFixed(2)}</td>
                <td>${selected.avco ? "RM" + selected.avco.toFixed(2) : ""}</td>
                <td>${selected.amount ? "RM" + selected.amount.toLocaleString() : ""}</td>
            </tr>
        `);
		});
	}

	// ---- Dealer summary (new) ----
	async show_dealer_summary() {
		this.selected.clear();
		this.summary_container.empty();

		let dealers = [];
		try {
			dealers = await frappe.xcall("gold_app.api.page_api.get_dealer_summary");
		} catch (err) {
			console.error(err);
			this.container.html(
				'<div class="alert alert-danger ml-5 mr-5">Failed to load dealers</div>'
			);
			return;
		}

		if (!dealers || dealers.length === 0) {
			this.container.html('<div class="alert alert-info ml-5 mr-5">No dealers found.</div>');
			return;
		}

		const $tbl = $(`
        <table class="table table-sm table-bordered">
          <thead>
            <tr>
              <th style="width:36px"></th>
              <th>Date Range</th>
              <th>Dealer</th>
              <th>Purities</th>
              <th style="text-align:right">Total Weight (g)</th>
              <th style="text-align:right">Avg AvCo (RM/g)</th>
              <th style="text-align:right">Total Amount (MYR)</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
    `).appendTo(this.summary_container);

		const $tbody = $tbl.find("tbody");

		dealers.forEach((d) => {
			const $tr = $(`
            <tr class="dealer-row" data-dealer="${frappe.utils.escape_html(d.dealer)}">
              <td class="toggle-cell" style="cursor:pointer; text-align:center;">
                <i class="fa fa-chevron-right"></i>
              </td>
              <td>${frappe.utils.escape_html(d.date_range || "")}</td>
              <td>${frappe.utils.escape_html(d.dealer)}</td>
              <td>${frappe.utils.escape_html(d.purities || "")}</td>
              <td class="text-right">${(d.total_weight || 0).toFixed(2)}</td>
              <td class="text-right">${(d.avco_rate || 0).toFixed(2)}</td>
              <td class="text-right">RM ${(d.amount || 0).toFixed(2)}</td>
            </tr>
        `).appendTo($tbody);

			// hidden detail row for purities
			const $details =
				$(`<tr class="dealer-detail d-none" data-dealer="${frappe.utils.escape_html(
					d.dealer
				)}">
            <td colspan="7"><div class="purity-container p-2">Loading...</div></td>
        </tr>`).appendTo($tbody);

			// toggle click handler
			$tr.find(".toggle-cell").on("click", async () => {
				const icon = $tr.find(".fa");
				const showing = !$details.hasClass("d-none");
				if (showing) {
					$details.addClass("d-none");
					icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
				} else {
					icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
					await this.show_overview(d.dealer);
					const $container = $details.find(".purity-container");
					if (!$container.data("loaded")) {
						$container.html('<div class="text-muted">Loading purities...</div>');
						let rows = [];
						try {
							rows = await frappe.xcall("gold_app.api.page_api.get_summary", {
								dealer: d.dealer,
							});
						} catch (err) {
							console.error(err);
							$container.html(
								'<div class="text-danger">Failed to load purities</div>'
							);
							$container.data("loaded", true);
							return;
						}
						this.render_purities($container, d.dealer, rows);
						$container.data("loaded", true);
					}
					$details.removeClass("d-none");
				}
			});
		});
	}

	// ---- Dealer summary with expand for purities ----
	render_purities($container, dealer, rows) {
		$container.empty();
		if (!rows || rows.length === 0) {
			$container.html('<div class="text-muted">No purities found for this dealer.</div>');
			return;
		}

		const nested = {};
		rows.forEach((r) => {
			const p = r.purity || "Unknown";
			nested[p] = nested[p] || { pickup: null, nonpickup: null };
			if (r.is_pickup) nested[p].pickup = r;
			else nested[p].nonpickup = r;
		});

		const purities = Object.keys(nested).sort();
		const $tbl = $(`
        <table class="table table-sm table-bordered">
          <thead>
            <tr>
              <th style="width:36px"></th>
              <th>Purity</th>
              <th style="text-align:right">Total Weight</th>
              <th style="text-align:right">Avg AvCo</th>
              <th style="text-align:right">Total Amount</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
    `).appendTo($container);

		const $tbody = $tbl.find("tbody");

		purities.forEach((purity) => {
			const group = nested[purity];
			const displayRow = group.nonpickup ||
				group.pickup || { total_weight: 0, avco_rate: 0, amount: 0 };

			const $tr = $(`
            <tr class="purity-row" data-purity="${frappe.utils.escape_html(purity)}">
              <td class="toggle-cell" style="cursor:pointer; text-align:center;"><i class="fa fa-chevron-right"></i></td>
              <td>${frappe.utils.escape_html(purity)}</td>
              <td class="text-right">${(displayRow.total_weight || 0).toFixed(2)}</td>
              <td class="text-right">${(displayRow.avco_rate || 0).toFixed(2)}</td>
              <td class="text-right">${(displayRow.amount || 0).toFixed(2)}</td>
            </tr>
        `).appendTo($tbody);

			const $details = $(
				`<tr class="purity-detail d-none" data-purity="${frappe.utils.escape_html(
					purity
				)}"><td colspan="6"><div class="detail-container p-2">Loading...</div></td></tr>`
			).appendTo($tbody);

			// toggle to show items
			$tr.find(".toggle-cell").on("click", async () => {
				const icon = $tr.find(".fa");
				const showing = !$details.hasClass("d-none");
				if (showing) {
					$details.addClass("d-none");
					icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
				} else {
					icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
					const $container = $details.find(".detail-container");
					if (!$container.data("loaded")) {
						let items = [];
						try {
							items = await frappe.xcall("gold_app.api.page_api.get_items", {
								dealer,
								purity,
							});
						} catch (err) {
							console.error(err);
							$container.html('<div class="text-danger">Failed to load items</div>');
							$container.data("loaded", true);
							return;
						}
						this.render_items($container, items);
						$container.data("loaded", true);
					}
					$details.removeClass("d-none");
				}
			});
		});
	}

	// ---- refresh / purity / items flow (reused) ----
	async refresh() {
		this.selected.clear();
		this.container.empty();

		const dealer = this.current_dealer;
		if (!dealer) {
			// show dealer list if none selected
			await this.show_dealer_summary();
			return;
		}

		// call server for summary (purity-level)
		let rows = [];
		try {
			rows = await frappe.xcall("gold_app.api.page_api.get_summary", { dealer: dealer });
		} catch (err) {
			console.error(err);
			this.container.html(
				'<div class="alert alert-danger ml-5 mr-5">Error loading data. Check console.</div>'
			);
			return;
		}

		const nested = {};
		rows.forEach((r) => {
			const p = r.purity || "Unknown";
			nested[p] = nested[p] || { pickup: null, nonpickup: null };
			if (r.is_pickup) nested[p].pickup = r;
			else nested[p].nonpickup = r;
		});

		const purities = Object.keys(nested).sort();
		const purities_to_render = this.only_nonpickup
			? purities.filter((p) => nested[p].nonpickup)
			: purities;

		// header
		$(`
            <div class="mb-2 ml-5">
              <h5>Dealer: ${frappe.utils.escape_html(dealer)}</h5>
            </div>
        `).appendTo(this.container);

		// totals by dealer (sum both pickup+nonpickup)
		let dealer_weight = 0,
			dealer_amount = 0;
		Object.values(nested).forEach((group) => {
			if (group.pickup) {
				dealer_weight += group.pickup.total_weight || 0;
				dealer_amount += group.pickup.amount || 0;
			}
			if (group.nonpickup) {
				dealer_weight += group.nonpickup.total_weight || 0;
				dealer_amount += group.nonpickup.amount || 0;
			}
		});

		$(
			`<div class="mb-3 mr-5 text-right text-muted">Dealer Totals — Weight: ${dealer_weight.toFixed(
				2
			)} g, Amount: ${dealer_amount.toFixed(2)} MYR</div>`
		).appendTo(this.container);

		// table header
		const $table = $(`<table class="table table-sm table-bordered"><thead>
            <tr>
              <th style="width:36px"></th>
              <th>Purity</th>
              <th style="text-align:right">Total Weight (g)</th>
              <th style="text-align:right">Avg AvCo (RM/g)</th>
              <th style="text-align:right">Total Amount (MYR)</th>
            </tr>
        </thead><tbody></tbody></table>`).appendTo(this.container);

		const $tbody = $table.find("tbody");

		if (purities_to_render.length === 0) {
			$tbody.append(
				'<tr><td colspan="6" class="text-center text-muted">No data found for selected filters.</td></tr>'
			);
			return;
		}

		for (const purity of purities_to_render) {
			const group = nested[purity];
			const displayRow = group.nonpickup ||
				group.pickup || { total_weight: 0, avco_rate: 0, amount: 0, is_pickup: 0 };

			const $tr = $(`
                <tr class="purity-row" data-purity="${frappe.utils.escape_html(purity)}">
                  <td class="toggle-cell" style="cursor:pointer; text-align:center;"><i class="fa fa-chevron-right"></i></td>
                  <td>${frappe.utils.escape_html(purity)}</td>
                  <td style="text-align:right">${(displayRow.total_weight || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(displayRow.avco_rate || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(displayRow.amount || 0).toFixed(2)}</td>
                </tr>
            `).appendTo($tbody);

			const $details = $(
				`<tr class="purity-detail d-none" data-purity="${frappe.utils.escape_html(
					purity
				)}"><td colspan="6"><div class="detail-container p-2">Loading...</div></td></tr>`
			).appendTo($tbody);

			// toggle / view handler
			$tr.find(".toggle-cell, .view-items").on("click", async () => {
				const icon = $tr.find(".fa");
				const showing = !$details.hasClass("d-none");
				if (showing) {
					$details.addClass("d-none");
					icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
				} else {
					icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
					const $container = $details.find(".detail-container");
					if (!$container.data("loaded")) {
						$container.html('<div class="text-muted">Loading items...</div>');
						const args = { dealer: dealer, purity: purity };
						if (this.only_nonpickup) args.is_pickup = 0;
						let items = [];
						try {
							items = await frappe.xcall("gold_app.api.page_api.get_items", args);
						} catch (err) {
							console.error(err);
							$container.html('<div class="text-danger">Failed to load items</div>');
							$container.data("loaded", true);
							return;
						}
						this.render_items($container, items);
						$container.data("loaded", true);
						// Auto-select all after render
						$container.find(".item-select").each((i, cb) => {
							cb.checked = true;
							this.selected.add(cb.getAttribute("data-name"));
						});
						this.update_primary_action_label();
					}
					$details.removeClass("d-none");
				}
			});

			// select-all handler
			$tr.find(".purity-select").on("change", async (e) => {
				const checked = $(e.currentTarget).is(":checked");
				const $container = $details.find(".detail-container");
				if (!$container.data("loaded")) {
					$tr.find(".toggle-cell").trigger("click");
					await new Promise((r) => setTimeout(r, 300));
				}
				$container.find(".item-select").each((i, cb) => {
					cb.checked = checked;
					const name = cb.getAttribute("data-name");
					if (checked) this.selected.add(name);
					else this.selected.delete(name);
				});
				this.update_primary_action_label();
			});
		}

		this.update_primary_action_label();
	}

	render_items($container, items) {
		$container.empty();
		if (!items || items.length === 0) {
			$container.html('<div class="text-muted">No items found for this purity.</div>');
			return;
		}

		const $tbl = $(`
            <table class="table table-sm table-hover">
              <thead>
                <tr>
                  <th style="width:36px"><input type="checkbox" class="detail-select-all" /></th>
                  <th>Date</th>
                  <th>Item Code</th>
                  <th style="text-align:right">Weight (g)</th>
                  <th style="text-align:right">AvCo (RM/g)</th>
                  <th style="text-align:right">Amount (MYR)</th>
                  <th>Purchase Receipt</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
        `).appendTo($container);

		const $tbody = $tbl.find("tbody");

		items.forEach((it) => {
			const dstr = it.date ? frappe.datetime.str_to_user(it.date) : "";
			const $tr = $(`
                <tr>
                  <td><input type="checkbox" class="item-select" data-name="${frappe.utils.escape_html(
						it.name
					)}"></td>
                  <td>${frappe.utils.escape_html(dstr)}</td>
                  <td>${frappe.utils.escape_html(it.item_code || "")}</td>
                  <td style="text-align:right">${(it.total_weight || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(it.avco_rate || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(it.amount || 0).toFixed(2)}</td>
                  <td>${frappe.utils.escape_html(it.purchase_receipt || "")}</td>
                </tr>
            `).appendTo($tbody);

			$tr.find(".item-select").on("change", (e) => {
				const checked = $(e.currentTarget).is(":checked");
				const name = e.currentTarget.getAttribute("data-name");
				if (checked) this.selected.add(name);
				else this.selected.delete(name);
				this.update_primary_action_label();
			});
		});

		// detail-wide select all
		$tbl.find(".detail-select-all").on("change", (e) => {
			const checked = $(e.currentTarget).is(":checked");
			$container.find(".item-select").each((i, cb) => {
				cb.checked = checked;
				const name = cb.getAttribute("data-name");
				if (checked) this.selected.add(name);
				else this.selected.delete(name);
			});
			this.update_primary_action_label();
		});
	}

	update_primary_action_label() {
		const count = this.selected.size;
		const label = count ? `Mark Pickup` : "Mark Pickup";
		// const label = count ? `Mark Pickup (${count})` : "Mark Pickup";
		this.page.set_primary_action(label, () => this.change_selected_pickup(true));
	}

	async change_selected_pickup(is_pickup) {
		if (!this.selected.size) {
			frappe.msgprint(__("No rows selected"));
			return;
		}

		const proceed = window.confirm(
			`Are you sure you want to mark ${this.selected.size} item(s) as ${
				is_pickup ? "Pickup" : "Non-Pickup"
			}?`
		);
		if (!proceed) return;

		const docnames = JSON.stringify(Array.from(this.selected));
		const args = { docnames: docnames, is_pickup: is_pickup ? 1 : 0 };

		let res;
		try {
			res = await frappe.xcall("gold_app.api.page_api.bulk_update_pickup", args);
		} catch (err) {
			console.error(err);
			frappe.msgprint(__("Bulk update failed. Check console for details."));
			return;
		}

		let message = `Updated: ${res.updated || 0}`;
		if (res.skipped && res.skipped.length) message += `\nSkipped: ${res.skipped.length}`;
		if (res.errors && res.errors.length)
			message += `\nErrors: ${res.errors.length} (check server logs)`;
		frappe.msgprint(message);

		await this.refresh();
	}

	async assign_selected_to() {
		if (!this.selected.size) {
			frappe.msgprint(__("No rows selected"));
			return;
		}

		const d = new frappe.ui.Dialog({
			title: __("Assign To User"),
			fields: [
				{
					fieldtype: "Link",
					fieldname: "user",
					label: "User",
					options: "User",
					reqd: 1,
					get_query: () => {
						return {
							query: "frappe.core.doctype.user.user.user_query",
							filters: { role: "Staff" },
						};
					},
				},
			],
			primary_action_label: __("Assign"),
			primary_action: async (values) => {
				d.hide();
				const docnames = JSON.stringify(Array.from(this.selected));
				const args = { docnames: docnames, assigned_to: values.user };
				let res;
				try {
					res = await frappe.xcall("gold_app.api.page_api.bulk_update_pickup", args);
				} catch (err) {
					console.error(err);
					frappe.msgprint(__("Assignment failed. Check console for details."));
					return;
				}
				let message = `Assigned to ${values.user}\nUpdated: ${res.updated || 0}`;
				if (res.skipped && res.skipped.length)
					message += `\nSkipped: ${res.skipped.length}`;
				if (res.errors && res.errors.length)
					message += `\nErrors: ${res.errors.length} (check server logs)`;
				frappe.msgprint(message);
				await this.refresh();
			},
		});

		d.show();
	}
}
