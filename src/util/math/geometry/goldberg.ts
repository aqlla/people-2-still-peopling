import * as THREE from "three";
import { TODO, Tup } from "../../types.ts";
import { Cartesian3D } from "./coordinates.ts";
import { faceHasEdge, getApex, hasVertIndex, Tri, Cartesian3dToArr, getVertTup, getBase } from "./triangles.ts";
import { getFaces, getVertices } from "../../three-tools";

export type Tile = {
	vertices: [THREE.Vector3];
	faces?: [THREE.Face];
	centroid: Cartesian3D;
	center?: number;
	facet?: number;
};

export const projectToSphere = (geometry, radius: number) => {
	geometry.vertices.forEach((vertex) =>
		vertex.normalize().multiplyScalar(radius)
	);
	geometry.verticesNeedUpdate = true;
}

const getFacesWithCommonVertex = (faces: Tri[]) => 
	(i: number) => faces.filter((f) => hasVertIndex(i, f));

const vertHasNumAdjacentFaces = (n: number, faces: Tri[]) => 
	(i: number) => getFacesWithCommonVertex(faces)(i).length === n;

const getAdjacentHex = 
	(geo, oldCenter: number, cache: Set<Tri>, facet: number) => 
	(commonEdge: Tup<2>) => {
		const adjFace = geo.faces
			// Get faces with edge, filter out face having `oldCenter` vert, as that is the
			// old one which we got the `commonEdge` from.
			.find((f: Tri) =>
				!cache.has(f) &&
				faceHasEdge(commonEdge, f) &&
				!getVertTup(f).includes(oldCenter)
			);

		if (!adjFace) {
			return [];
		}

		// Get center of the new hex.
		const center = getApex(commonEdge)(adjFace)!;

		// Get other faces which share the new center
		const hexFaces = geo.faces
			.filter((f: Tri) => hasVertIndex(center, f))
			.each((f: Tri) => cache.add(f));

		const verts = hexFaces
			.flatMap(getVertTup)
			.distinct()
			.filter(notequal(center));

		return {
			center: center,
			faces: hexFaces,
			verts: verts,
			facet,
			vertices: verts.map((v: number) => geo.vertices[v]),
			centroid: geo.vertices[center],
		};
	};

const getTileFromCenter = (geo, cache: Set<Tri>) => (center: number, i: number) => {
	const faces = geo.faces
		.filter((f: Tri) => !cache.has(f) && hasVertIndex(center, f))
		.each((f: Tri) => cache.add(f));

	const verts = faces
		.flatMap(getVertTup)
		.distinct()
		.filter(notequal(center));

	return {
		center,
		faces,
		verts,
		facet: i,
		vertices: verts.map((v: number) => geo.vertices[v]),
		centroid: geo.vertices[center],
	};
};

const notequal = (obj1: any) => 
	(obj2: any) => 
		obj1 !== obj2

const getHexesAroundTile = (geo, cache: Set<Tri>, tile: Tile, limits?: Tup<2>): Tile[] => {
	if (cache.size === geo.faces.length) return [];
	const { center, faces, facet } = tile;
	const searchFaces = limits ? faces!.slice(limits[0], limits[1] + 1) : faces;

	const immediateHexes = searchFaces!
		// Get face edge opposite the center vert
		.map((face: Tri) => {
			const commonEdge = getBase(center!, face);
			return getAdjacentHex(geo, center!, cache, facet!)(commonEdge);
		});

	const hexes: Tile[] = [];
	// Using imperative loop because I ran into call stack limits
	for (const h of immediateHexes.flat()) {
		hexes.push(...getHexesAroundTile(geo, cache, h, [2, 4]));
	}
	return [tile, ...hexes];
};

// Function to group faces into pentagons and hexagons
export const groupFaces = (geo) => {
	const cache = new Set<Tri>();
	console.log("hi")
	return (getVertices(geo) as TODO)
		.filter(vertHasNumAdjacentFaces(5, getFaces(geo)))
		.map(getTileFromCenter(geo, cache))
		.flatMap((p: Tile) => getHexesAroundTile(geo, cache, p));
};

export const toJson = (tiles: Tile[]) => {
	return JSON.stringify(
		tiles.map((t: Tile) => ({
			facet: t.facet,
			center: t.center,
			centroid: t.centroid,
			vertices: t.vertices.map(Cartesian3dToArr),
		}))
	);
};