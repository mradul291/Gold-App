frappe.pages["gold-sorting"].on_page_load = function (wrapper) {
	new PoolPage(wrapper);
};

class PoolPage {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: "Gold Sorting",
			single_column: true,
		});

		this.container = $('<div class="pool-container"></div>').appendTo(this.page.main);
		this.table_container = $('<div style="margin-top:20px;"></div>').appendTo(this.container);
		this.entry_table_container = $('<div style="margin-top:30px;"></div>').appendTo(
			this.container
		);
		this.final_table_container = $('<div style="margin-top:30px;"></div>').appendTo(
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
				options: ["Select Pool..."],
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
			"<thead><tr><th>Purity</th><th>Total Weight (g)</th><th>Remaining Weight (g)</th><th>AVCO</th><th>Total Cost</th></tr></thead>"
		);
		table.append(thead);

		let tbody = $("<tbody></tbody>");
		this.last_data.forEach((row) => {
			tbody.append(`<tr>
                <td>${row["Purity"]}</td>
                <td>${row["Total Weight (g)"]}</td>
                <td class="remaining-weight" data-purity="${row["Purity"]}">
                    ${row["Total Weight (g)"]}
                </td>
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

		// Prepare Purity options for dropdown
		let purity_options = this.last_data
			.map(
				(row) =>
					`<option value="${row["Purity"]}" data-rate="${row["AVCO (RM/g)"]}">${row["Purity"]}</option>`
			)
			.join("");

		// Build table structure
		let table = $("<table class='table table-bordered entry-table'></table>");
		let thead = $(`
        <thead>
            <tr>
                <th>Purity</th>
                <th>Item Group</th>
                <th>Weight (g)</th>
                <th>Length (CM)</th>
                <th>Valuation Rate</th>
                <th>Target WH</th>
                <th>Print</th>
                <th></th>
            </tr>
        </thead>
    `);
		table.append(thead);

		let tbody = $("<tbody></tbody>");
		table.append(tbody);

		this.entry_table_container.append("<h4>Retail Entry</h4>");
		this.entry_table_container.append(table);

		let remainingTableContainer = $('<div style="margin-top:20px;"></div>').appendTo(
			this.entry_table_container
		);
		const renderRemainingTransferTable = () => {
			remainingTableContainer.empty();

			let table = $("<table class='table table-bordered remaining-stock-transfer'></table>");
			let thead = $(
				"<thead><tr><th>Purity</th><th>Source Item</th><th>Weight (g)</th><th>Target Warehouse</th></tr></thead>"
			);
			table.append(thead);

			let tbody = $("<tbody></tbody>");
			table.append(tbody);

			let addedPurities = {};

			// Loop through Retail Entry table rows
			this.entry_table_container.find(".entry-table tbody tr").each((_, tr) => {
				let $tr = $(tr);
				let purity = $tr.find("select[name='purity']").val();
				if (!purity || addedPurities[purity]) return;

				addedPurities[purity] = true;

				let sourceItem = `Unsorted-${purity}`;
				let targetWarehouseSelect = `<select class="form-control target-warehouse">${wh_options}</select>`;

				// Get total weight for this purity from last_data
				let totalWeight = 0;
				this.last_data.forEach((d) => {
					if (d["Purity"] === purity)
						totalWeight = parseFloat(d["Total Weight (g)"]) || 0;
				});

				// Calculate used quantity from Retail Entry table
				let usedQty = 0;
				this.entry_table_container.find(".entry-table tbody tr").each((_, r) => {
					let p = $(r).find("select[name='purity']").val();
					let q = parseFloat($(r).find("input[name='qty']").val() || 0);
					if (p === purity) usedQty += q;
				});

				let remainingQty = totalWeight - usedQty;
				remainingQty = remainingQty < 0 ? 0 : remainingQty;

				tbody.append(`
            <tr>
                <td>${purity}</td>
                <td>${sourceItem}</td>
                <td>${remainingQty.toFixed(3)}</td>
                <td>${targetWarehouseSelect}</td>
            </tr>
        `);
			});

			remainingTableContainer.append("<h4>Wholesale Entry</h4>");
			remainingTableContainer.append(table);
		};

		// Buttons
		let addRowBtn = $('<button class="btn btn-sm btn-primary mt-2">Add Row</button>');
		let saveBtn = $(
			'<button class="btn btn-sm btn-success mt-2 ms-2 ml-1">Save Stock Entry</button>'
		);

		this.entry_table_container.append(addRowBtn).append(saveBtn);

		// Helper: Add Row
		let addRow = (purity = "", valuation_rate = 0) => {
			let row = $(`
            <tr>
                <td>
                    <select class="form-control" name="purity">
                        <option value="">Select Purity</option>
                        ${purity_options}
                    </select>
                </td>
				<td style="display:none">
            		<input type="text" class="form-control" name="source_item" readonly>
        		</td>                
				<td><select class="form-control" name="item_group">${ig_options}</select></td>
                <td><input type="number" class="form-control" name="qty" min="0"></td>
                <td><input type="number" class="form-control" name="item_length" min="0" step="0.01" placeholder="Length (CM)"></td>
                <td><input type="number" class="form-control" name="valuation_rate" value="${valuation_rate}" step="0.01" readonly></td>
                <td><select class="form-control" name="target_warehouse">${wh_options}</select></td>
                <td class="text-center">
                    <button class="btn btn-success btn-sm print-row">
                        <i class="fa fa-print"></i>
                    </button>
                </td>
                <td><button class="btn btn-danger btn-sm remove-row">X</button></td>
            </tr>
        `);
			row.find("select[name='purity']").on("change", function () {
				let selected = $(this).find("option:selected");
				let purityVal = selected.val();
				row.find("input[name='valuation_rate']").val(selected.data("rate") || 0);

				if (purityVal) {
					row.find("input[name='source_item']").val(`Unsorted-${purityVal}`);
				} else {
					row.find("input[name='source_item']").val("");
				}
			});

			if (purity) row.find("select[name='purity']").val(purity);

			// Events
			row.find(".remove-row").on("click", () => row.remove());

			row.find(".print-row").on("click", () => {
				let itemCode = row.find("input[name='item_code']").val();
				if (!itemCode) {
					frappe.msgprint("No Item Code available to print.");
					return;
				}
				frappe.msgprint(`Print action triggered for Item: <b>${itemCode}</b>`);
				// ✅ Later you can replace with actual print logic
			});

			row.find("select[name='purity']").on("change", function () {
				let selected = $(this).find("option:selected");
				row.find("input[name='valuation_rate']").val(selected.data("rate") || 0);
				if (row.find("select[name='purity']").val()) {
					renderRemainingTransferTable();
				}
			});

			row.find("select[name='item_group']").on("change", function () {
				// Just update the value in the row, do not create the item now
				let selected_group = $(this).val();
				if (selected_group) {
					row.find("input[name='item_code']").val(""); // Clear item_code, will be created on save
				}
			});

			row.find("input[name='qty']").on("input", () => {
				this.update_remaining_weights();
				renderRemainingTransferTable();
			});

			tbody.append(row);
			renderRemainingTransferTable();
		};

		// Show only ONE blank row on page load
		addRow();

		// Add new empty row button
		addRowBtn.on("click", () => addRow());
		renderRemainingTransferTable();

		// Save button logic remains unchanged
		saveBtn.on("click", async () => {
			let rows = [];
			tbody.find("tr").each(function () {
				let r = $(this);
				rows.push({
					purity: r.find("select[name='purity']").val(),
					source_item: r.find("input[name='source_item']").val(),
					qty: r.find("input[name='qty']").val(),
					item_code: r.find("input[name='item_code']").val(),
					item_length: r.find("input[name='item_length']").val(),
					valuation_rate: r.find("input[name='valuation_rate']").val(),
					target_warehouse: r.find("select[name='target_warehouse']").val(),
					item_group: r.find("select[name='item_group']").val(),
				});
			});

			// Collect remaining transfers
			let remainingTransfers = [];
			$(".remaining-stock-transfer tbody tr").each(function () {
				remainingTransfers.push({
					purity: $(this).find("td").eq(0).text(),
					target_warehouse: $(this).find("select.target-warehouse").val(),
				});
			});

			if (!rows.length) {
				frappe.msgprint("Please add at least one row before saving.");
				return;
			}

			try {
				let res = await frappe.xcall("gold_app.api.pooling.create_stock_entry_from_pool", {
					purity_data: JSON.stringify(rows),
					pool_name: this.pool_name,
					remaining_transfers: JSON.stringify(remainingTransfers),
				});
				this.render_final_table(res.created_items || [], remainingTransfers);

				frappe.msgprint({
					title: "Success",
					message: `Stock Entry <a href="/app/stock-entry/${res.name}">${res.name}</a> created.`,
					indicator: "green",
				});

				await this.fetch_and_render_pool_data(this.pool_name);
			} catch (err) {
				console.error(err);
				frappe.msgprint("Failed to create Stock Entry.");
			}
		});
	}

	update_remaining_weights() {
		let remainingByPurity = {};

		// 1. Start with total weight for each purity
		this.last_data.forEach((row) => {
			remainingByPurity[row["Purity"]] = parseFloat(row["Total Weight (g)"]) || 0;
		});

		// 2. Subtract qty from Stock Entry rows for matching purity
		$(".entry-table tbody tr").each(function () {
			let purity = $(this).find("select[name='purity']").val();
			let qty = parseFloat($(this).find("input[name='qty']").val() || 0);
			if (purity && remainingByPurity[purity] !== undefined) {
				remainingByPurity[purity] -= qty;
			}
		});

		// 3. Update UI in summary table
		this.table_container.find(".remaining-weight").each(function () {
			let purity = $(this).data("purity");
			let remaining = remainingByPurity[purity] || 0;
			$(this).text(remaining >= 0 ? remaining.toFixed(3) : "0.000");
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
		let item_length = row.find("input[name='item_length']").val();

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
						item_length:
							item_length === "" || item_length === null
								? null
								: parseFloat(item_length),
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

	render_final_table(created_items = [], remainingTransfers = []) {
		this.final_table_container.empty();

		if (!created_items.length) {
			this.final_table_container.html("<p>No Stock Entry data to display.</p>");
			return;
		}

		let table = $("<table class='table table-bordered'></table>");
		let thead = $(`
        <thead>
            <tr>
                <th>Purity</th>
                <th>Item Code</th>
                <th>Retail Weight (g)</th>
                <th>Retail Warehouse</th>
                <th>Wholesale Warehouse</th>
            </tr>
        </thead>
    `);
		table.append(thead);

		let tbody = $("<tbody></tbody>");
		let remainingMap = {};

		if (remainingTransfers && remainingTransfers.length) {
			remainingTransfers.forEach((rt) => {
				remainingMap[rt.purity] = rt.target_warehouse || "Bag 1 - Wholesale - AGSB";
			});
		}

		created_items.forEach((row) => {
			tbody.append(`
            <tr>
                <td>${row.purity || ""}</td>
                <td>${row.item_code || "-"}</td>
                <td>${row.qty || 0}</td>
                <td>${row.target_warehouse || ""}</td>
                <td>${remainingMap[row.purity] || ""}</td>
            </tr>
        `);
		});

		table.append(tbody);
		this.final_table_container.append("<h4>Final Stock Summary</h4>");
		this.final_table_container.append(table);
	}
}
