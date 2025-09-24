import frappe
from frappe.model.document import Document

class GoldPool(Document):
    def autoname(self):
        """
        Auto-generate name based on pool_type:
        Dealer → DLR-POOL-####
        Branch → RTL-POOL-####
        """
        if self.pool_type == "Dealer":
            prefix = "DLR-POOL-"
        elif self.pool_type == "Branch":
            prefix = "RTL-POOL-"
        else:
            prefix = "POOL-"

        # Get last series number
        last = frappe.db.sql(f"""
            SELECT name FROM `tabGold Pool`
            WHERE name LIKE '{prefix}%'
            ORDER BY name DESC LIMIT 1
        """, as_dict=True)

        if last:
            last_number = int(last[0]['name'].split("-")[-1])
            next_number = last_number + 1
        else:
            next_number = 1

        self.name = f"{prefix}{str(next_number).zfill(4)}"
