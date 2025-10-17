import frappe

@frappe.whitelist()
def get_warehouse_stock(warehouse_name=None):
    frappe.logger().info(f"🔹 get_warehouse_stock called with: {warehouse_name}")

    if not warehouse_name:
        return []

    data = frappe.db.sql(
        """
        SELECT
            item.purity AS purity,
            SUM(bin.actual_qty) AS total_qty,
            AVG(bin.valuation_rate) AS avg_rate,
            SUM(bin.actual_qty * bin.valuation_rate) AS total_amount_rm
        FROM
            `tabBin` AS bin
        JOIN
            `tabItem` AS item ON bin.item_code = item.name
        WHERE
            bin.warehouse = %s
        GROUP BY
            item.purity
        """,
        (warehouse_name,),
        as_dict=True
    )

    frappe.logger().info(f"Stock found for {warehouse_name}: {data}")
    return data
