import html

def escape(s):
    return html.escape(s).replace('"', '&quot;').replace("'", '&apos;').replace('\n', '&#xa;')

# We will construct an mxGraph XML file
cells = []
cell_id = 1

def next_id():
    global cell_id
    cell_id += 1
    return str(cell_id)

def add_cell(cell_xml):
    cells.append(cell_xml)

# Root containers
cells.append('<mxCell id="0"/>')
cells.append('<mxCell id="1" parent="0"/>')

def create_vertex(cid, value, x, y, w, h, style):
    val = escape(value)
    return f'<mxCell id="{cid}" value="{val}" style="{style}" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'

def create_edge(cid, value, source, target, style):
    val = escape(value) if value else ""
    return f'<mxCell id="{cid}" value="{val}" style="{style}" edge="1" parent="1" source="{source}" target="{target}"><mxGeometry relative="1" as="geometry"/></mxCell>'

# Styles
CONTAINER_STYLE = "swimlane;startSize=30;rounded=1;arcSize=8;fontStyle=1;fontSize=13;strokeWidth=2;shadow=0;"
NODE_STYLE = "rounded=1;whiteSpace=wrap;html=1;fontSize=11;strokeWidth=1.5;shadow=0;arcSize=10;"
DECISION_STYLE = "rhombus;whiteSpace=wrap;html=1;fontSize=11;strokeWidth=1.5;shadow=0;fontStyle=1;"
EDGE_STYLE = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;fontSize=10;strokeWidth=2;"

print("Generator script template ready")
