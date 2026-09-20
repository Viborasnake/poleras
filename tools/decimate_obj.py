from pathlib import Path

src = Path('public/over-model/obj.obj')
dst = Path('public/over-model/oversize-lite.obj')
vertices = []
texcoords = []
normals = []
faces = []
material = 'Knit_Cotton_Jersey_FRONT_2708'
face_index = 0

with src.open('r', encoding='utf-8', errors='ignore') as handle:
    for line in handle:
        if line.startswith('v '):
            vertices.append(line.strip())
        elif line.startswith('vt '):
            texcoords.append(line.strip())
        elif line.startswith('vn '):
            normals.append(line.strip())
        elif line.startswith('usemtl '):
            material = line.split(None, 1)[1].strip()
        elif line.startswith('f '):
            face_index += 1
            if face_index % 30:
                continue
            refs = line.split()[1:]
            if len(refs) < 3:
                continue
            faces.append((material, refs[:3]))

used_v, used_vt, used_vn = {}, {}, {}
out_faces = []
for mat, refs in faces:
    remapped = []
    for ref in refs:
        parts = ref.split('/')
        vi = int(parts[0]); vkey = vi if vi > 0 else len(vertices) + vi + 1
        if vkey not in used_v: used_v[vkey] = len(used_v) + 1
        ti = int(parts[1]) if len(parts) > 1 and parts[1] else 0
        ni = int(parts[2]) if len(parts) > 2 and parts[2] else 0
        tnew = 0
        nnew = 0
        if ti:
            tkey = ti if ti > 0 else len(texcoords) + ti + 1
            if tkey not in used_vt: used_vt[tkey] = len(used_vt) + 1
            tnew = used_vt[tkey]
        if ni:
            nkey = ni if ni > 0 else len(normals) + ni + 1
            if nkey not in used_vn: used_vn[nkey] = len(used_vn) + 1
            nnew = used_vn[nkey]
        remapped.append((used_v[vkey], tnew, nnew))
    out_faces.append((mat, remapped))

with dst.open('w', encoding='utf-8') as out:
    out.write('# Tolska oversize lightweight mesh\nmtllib obj.mtl\n')
    for old in sorted(used_v, key=used_v.get): out.write(vertices[old - 1] + '\n')
    for old in sorted(used_vt, key=used_vt.get): out.write(texcoords[old - 1] + '\n')
    for old in sorted(used_vn, key=used_vn.get): out.write(normals[old - 1] + '\n')
    current = None
    for mat, refs in out_faces:
        if mat != current:
            out.write(f'usemtl {mat}\n'); current = mat
        out.write('f ' + ' '.join(f'{v}/{t}/{n}' if t and n else str(v) for v, t, n in refs) + '\n')

print(f'faces={len(out_faces)} vertices={len(used_v)} output={dst.stat().st_size}')
