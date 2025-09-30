import frappe
from frappe.model.document import Document
from frappe.utils import today, formatdate

class GoldPool(Document):
    def autoname(self):
        """
        Auto-generate name based on pool_type:
        Dealer → DLR-POOL-DDMMYY-###
        Branch → RTL-POOL-DDMMYY-###
        """
        date_str = formatdate(today(), "ddMMyy")

        if self.pool_type == "Dealer":
            prefix = f"DLR-POOL-{date_str}-"
        elif self.pool_type == "Branch":
            prefix = f"RTL-POOL-{date_str}-"
        else:
            prefix = f"POOL-{date_str}-"

        # Get last series number for today's date
        last = frappe.db.sql(f"""
            SELECT name FROM `tabGold Pool`
            WHERE name LIKE '{prefix}%'
            ORDER BY name DESC LIMIT 1
        """, as_dict=True)

        if last:
            try:
                last_number = int(last[0]['name'].split("-")[-1])
            except ValueError:
                last_number = 0
            next_number = last_number + 1
        else:
            next_number = 1

        self.name = f"{prefix}{str(next_number).zfill(3)}"
