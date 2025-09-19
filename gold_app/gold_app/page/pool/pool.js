frappe.pages["pool"].on_page_load = function (wrapper) {
	new PoolPage(wrapper);
};

class PoolPage {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: "Pool",
			single_column: true,
		});

		this.container = $('<div class="pool-container"></div>').appendTo(this.page.main);
		this.table_container = $('<div style="margin-top:20px;"></div>').appendTo(this.container);
		this.entry_table_container = $('<div style="margin-top:30px;"></div>').appendTo(
			this.container
		);

		this.make_select_field();
		this.last_data = [];
		this.pool_name = null;
	}

	make_select_field() {
		let me = this;

		if (!this.container.find(".pool-top-bar").length) {
			this.top_bar = $(`
            <div class="pool-top-bar">
                <div class="select-field-container"></div>
                <div class="pool-status">
                    Status: <span class="status-value">--</span>
                </div>
            </div>
        `);
			this.container.prepend(this.top_bar);
		}

		this.select_field = new frappe.ui.form.ControlSelect({
			df: {
				fieldname: "gold_pool_select",
				label: "Select Gold Pool",
				fieldtype: "Select",
				options: ["Loading..."],
				reqd: 1,
			},
			parent: this.top_bar.find(".select-field-container"),
		});
		this.select_field.make_input();

		$(this.select_field.input).addClass("pool-select-input");

		$(this.select_field.input).on("focus", async function () {
			let options = await frappe.xcall("gold_app.api.pooling.get_gold_pool_options");
			me.select_field.df.options = options.length ? options : ["No Gold Pool Found"];
			me.select_field.refresh();
		});

		$(this.select_field.input).on("change", async function () {
			me.pool_name = me.select_field.get_value();
			if (me.pool_name) {
				await me.fetch_and_render_pool_data(me.pool_name);
				me.update_pool_status(me.pool_name);
			}
		});
	}

	async update_pool_status(pool_name) {
		try {
			let pool_doc = await frappe.db.get_doc("Gold Pool", pool_name);
			let statusEl = this.container.find(".status-value");
			statusEl.text(pool_doc.status || "--");
			statusEl.removeClass("status-green status-yellow status-red");

			if (pool_doc.status === "Completed") statusEl.addClass("status-green");
			else if (pool_doc.status === "In Progress") statusEl.addClass("status-yellow");
			else statusEl.addClass("status-red");
		} catch (err) {
			console.error("Failed to fetch pool status:", err);
			this.container.find(".status-value").text("Error").addClass("status-red");
		}
	}

	async fetch_and_render_pool_data(pool_name) {
		try {
			let data = await frappe.xcall("gold_app.api.pooling.get_gold_pool_data", {
				pool_name,
			});
			this.last_data = data.purity_breakdown || [];
			this.render_summary_table();
			this.render_entry_table();
		} catch (err) {
			frappe.msgprint("Failed to fetch Gold Pool data");
			console.error(err);
		}
	}

	render_summary_table() {
		this.table_container.empty();
		if (!this.last_data.length) {
			this.table_container.html("<p>No purity breakdown data found.</p>");
			return;
		}

		let table = $("<table class='table table-bordered'></table>");
		let thead = $(
			"<thead><tr><th>Purity</th><th>Total Weight (g)</th><th>AVCO</th><th>Total Cost</th></tr></thead>"
		);
		table.append(thead);

		let tbody = $("<tbody></tbody>");
		this.last_data.forEach((row) => {
			tbody.append(`<tr>
                <td>${row["Purity"]}</td>
                <td>${row["Total Weight (g)"]}</td>
                <td>${row["AVCO (RM/g)"]}</td>
                <td>${row["Total Cost (MYR)"]}</td>
            </tr>`);
		});
		table.append(tbody);
		this.table_container.append("<h4>Purity Summary</h4>");
		this.table_container.append(table);
	}

	async render_entry_table() {
		this.entry_table_container.empty();

		// Preload select options
		let warehouses = await frappe.db.get_list("Warehouse", { fields: ["name"], limit: 100 });
		let item_groups = await frappe.db.get_list("Item Group", { fields: ["name"], limit: 100 });

		let wh_options = warehouses
			.map((w) => `<option value="${w.name}">${w.name}</option>`)
			.join("");
		let ig_options = item_groups
			.map((g) => `<option value="${g.name}">${g.name}</option>`)
			.join("");

		let table = $("<table class='table table-bordered'></table>");
		let thead = $(
			"<thead><tr><th>Purity</th><th>Item Group</th><th>Qty</th><th>Item Code</th><th>Valuation Rate</th><th>Source WH</th><th>Target WH</th><th>Action</th></tr></thead>"
		);
		table.append(thead);

		let tbody = $("<tbody></tbody>");
		this.last_data.forEach((row) => {
			tbody.append(`
            <tr data-purity="${row["Purity"]}">
                <td>${row["Purity"]}</td>
                <td><select class="form-control" name="item_group">${ig_options}</select></td>
                <td><input type="number" class="form-control" name="qty" min="0"></td>
                <td><input type="text" class="form-control" name="item_code" placeholder="Item Code" readonly></td>
                <td><input type="number" class="form-control" name="valuation_rate" value="${
					row["AVCO (RM/g)"] || 0
				}" step="0.01" readonly></td>
                // <td><select class="form-control" name="source_warehouse">${wh_options}</select></td>
                <td><select class="form-control" name="target_warehouse">${wh_options}</select></td>
                <td><button class="btn btn-sm btn-success create-entry">Create</button></td>
            </tr>
        `);
		});

		table.append(tbody);
		this.entry_table_container.append("<h4>Create Stock Entry</h4>");
		this.entry_table_container.append(table);

		// 🔄 Attach auto-create item logic on Item Group change
		tbody.find("select[name='item_group']").on("change", async function () {
			let row = $(this).closest("tr");
			let selected_group = $(this).val();
			let valuation_rate = row.find("input[name='valuation_rate']").val(); // take AVCO as valuation rate

			if (selected_group) {
				try {
					// Call backend to create item with valuation rate
					let res = await frappe.xcall("gold_app.api.item.create_item_from_group", {
						item_group: selected_group,
						valuation_rate: valuation_rate || 0,
					});

					// Fill auto-generated item_code in the input field
					row.find("input[name='item_code']").val(res.item_code);

					frappe.show_alert({
						message: `Item <b>${res.item_code}</b> created for group <b>${selected_group}</b> with valuation rate ${valuation_rate}`,
						indicator: "green",
					});
				} catch (err) {
					console.error(err);
					frappe.msgprint("Failed to auto-create item for selected Item Group.");
				}
			}
		});

		// Attach click event per row
		this.entry_table_container.find(".create-entry").on("click", (e) => {
			let row = $(e.currentTarget).closest("tr");
			this.create_stock_entry_for_row(row);
		});
	}

	async create_stock_entry_for_row(row) {
		let purity = row.data("purity");
		let qty = row.find("input[name='qty']").val();
		let item_code = row.find("input[name='item_code']").val();
		let valuation_rate = row.find("input[name='valuation_rate']").val();
		let source_wh = row.find("select[name='source_warehouse']").val();
		let target_wh = row.find("select[name='target_warehouse']").val();
		let item_group = row.find("select[name='item_group']").val();

		if (!qty || !item_code || !source_wh || !target_wh || !item_group) {
			frappe.msgprint("Fill all fields before creating entry.");
			return;
		}

		try {
			let res = await frappe.xcall("gold_app.api.pooling.create_stock_entry_from_pool", {
				purity_data: JSON.stringify([
					{
						purity,
						qty,
						item_code,
						valuation_rate,
						source_warehouse: source_wh,
						target_warehouse: target_wh,
						item_group,
					},
				]),
				pool_name: this.pool_name,
			});

			frappe.msgprint({
				title: "Success",
				message: `Stock Entry <a href="/app/stock-entry/${res.name}">${res.name}</a> created.`,
				indicator: "green",
			});

			// Refresh data from backend (so remaining weight updates)
			await this.fetch_and_render_pool_data(this.pool_name);
		} catch (err) {
			console.error(err);
			frappe.msgprint("Failed to create Stock Entry.");
		}
	}
}
