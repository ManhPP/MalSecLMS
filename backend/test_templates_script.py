from app.services.vm_service import get_pve_client, get_available_templates

pve = get_pve_client()
print("PVE Client:", pve)
if pve:
    try:
        res = pve.cluster.resources.get(type="vm")
        print("Cluster resources total:", len(res))
        for r in res:
            print(f"VMID: {r.get('vmid')}, Name: {r.get('name')}, Template: {r.get('template')}, Status: {r.get('status')}")
    except Exception as e:
        print("Error getting cluster resources:", e)

    try:
        node_vms = pve.nodes("pve01").qemu.get()
        print("Node pve01 VMs total:", len(node_vms))
        for r in node_vms:
            print(f"Node VMID: {r.get('vmid')}, Name: {r.get('name')}, Template: {r.get('template')}, Status: {r.get('status')}")
    except Exception as e:
        print("Error getting node VMs:", e)

print("get_available_templates output:", get_available_templates())
