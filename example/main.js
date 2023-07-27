import { CameraProjections, IfcViewerAPI } from 'web-ifc-viewer';
import { createSideMenuButton } from './utils/gui-creator';
import {
  IFCSPACE, IFCOPENINGELEMENT, IFCFURNISHINGELEMENT, IFCWALL, IFCWALLSTANDARDCASE, IFCSLAB, IFCWINDOW, IFCCURTAINWALL, IFCMEMBER, IFCPLATE
} from 'web-ifc';
import {
  MeshBasicMaterial,
  LineBasicMaterial,
  Color,
  Vector2,
  DepthTexture,
  WebGLRenderTarget, Material, BufferGeometry, BufferAttribute, Mesh
} from 'three';
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";
import { ClippingEdges } from 'web-ifc-viewer/dist/components/display/clipping-planes/clipping-edges';
import Stats from 'stats.js/src/Stats';
import { MeshLambertMaterial, MeshNormalMaterial } from "three";

const container = document.getElementById('viewer-container');
const viewer = new IfcViewerAPI({ container, backgroundColor: new Color(255, 255, 255) });
window.modelIds = [];
window.models = [];

// CUSTOM!!!!!!!!!!!!!!!!!!!!!!!!!!!!
window.viewer = viewer;
window.ifc = viewer.IFC.loader.ifcManager;
console.log("IVO!!: Viewer set to window");
// optimized for picking
window.ifc.setupThreeMeshBVH(
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast);

window.getAllWallsProperties = async function() {
  const slabsID = await viewer.IFC.getAllItemsOfType(0, IFCWALL);
  console.log('All walls:');
  for (let i = 0; i <= slabsID.length; i++) {
    const slabID = slabsID[i];
    const slabProperties = await window.ifc.getItemProperties(0, slabID, true);
    console.log('slab properties[' + i + ']:');
    console.log(JSON.stringify(slabProperties));
  }
};

window.getModelIds = function() {
  return window.modelIds;
}

window.getAllIdsOfType = async function(modelID, type) {
  return await viewer.IFC.getAllItemsOfType(modelID, type);
}

async function getAll(category) {
  return window.ifc.getAllItemsOfType(0, category, false);
}

window.getAllPropertiesForId = async function(modelID) {
  return await window.ifc.getItemProperties(modelID, id, true);
}

window.greenMaterial = new MeshLambertMaterial({
  transparent: true,
  opacity: 0.6,
  color: 0x00ff00,
  depthTest: false,
});

window.createMaterial = function (color, opacity) {
  return new MeshLambertMaterial({
    transparent: true,
    opacity: opacity,
    color: color,
    depthTest: false,
  })
}

window.setItemsColor = function(modelID, ids, material) {
  window.ifc.createSubset({
    modelID: modelID,
    ids: ids,
    material: material,
    scene: viewer.context.getScene()
  });
}

window.setItemColor = function(modelID, id, material) {
  window.setItemsColor(modelID, [id], material);
}

const subsets = []
window.newSubsetOfType = async function(category) {
  const ids = await getAll(category);
  console.log(JSON.stringify(ids));
  const subset = window.ifc.createSubset({
    modelID: 0,
    scene: viewer.context.getScene(),
    ids,
    removePrevious: true,
    customID: category.toString(),
  });
  subsets.push(subset);
  viewer.context.getScene().add(subset);
  window.models[0].visible = false;
  return subset;
}

// CUSTOM!!!!!!!!!!!!!!!!!!!!!!!!!!!! </>

viewer.axes.setAxes();
viewer.grid.setGrid();
// viewer.shadowDropper.darkness = 1.5;

// Set up stats
const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.right = '0px';
stats.dom.style.left = 'auto';
viewer.context.stats = stats;

viewer.context.ifcCamera.cameraControls

const manager = viewer.IFC.loader.ifcManager;

async function getAllWallMeshes() {
 const wallsIDs = manager.getAllItemsOfType(0, IFCWALL, false);
 const meshes = [];
  const customID = 'temp-gltf-subset';

  for(const wallID of wallsIDs) {
   const coordinates = [];
   const expressIDs = [];
   const newIndices = [];

   const alreadySaved = new Map();

   const subset = viewer.IFC.loader.ifcManager.createSubset({
     ids: [wallID],
     modelID,
     removePrevious: true,
     customID
   });

   const positionAttr = subset.geometry.attributes.position;
   const expressIDAttr = subset.geometry.attributes.expressID;

   const newGroups = subset.geometry.groups.filter((group) => group.count !== 0);
   const newMaterials = [];
   const prevMaterials = subset.material;
   let newMaterialIndex = 0;
   newGroups.forEach((group) => {
     newMaterials.push(prevMaterials[group.materialIndex]);
     group.materialIndex = newMaterialIndex++;
   });

   let newIndex = 0;
   for (let i = 0; i < subset.geometry.index.count; i++) {
     const index = subset.geometry.index.array[i];

     if (!alreadySaved.has(index)) {
       coordinates.push(positionAttr.array[3 * index]);
       coordinates.push(positionAttr.array[3 * index + 1]);
       coordinates.push(positionAttr.array[3 * index + 2]);

       expressIDs.push(expressIDAttr.getX(index));
       alreadySaved.set(index, newIndex++);
     }

     const saved = alreadySaved.get(index);
     newIndices.push(saved);
   }

   const geometryToExport = new BufferGeometry();
   const newVerticesAttr = new BufferAttribute(Float32Array.from(coordinates), 3);
   const newExpressIDAttr = new BufferAttribute(Uint32Array.from(expressIDs), 1);

   geometryToExport.setAttribute('position', newVerticesAttr);
   geometryToExport.setAttribute('expressID', newExpressIDAttr);
   geometryToExport.setIndex(newIndices);
   geometryToExport.groups = newGroups;
   geometryToExport.computeVertexNormals();

   const mesh = new Mesh(geometryToExport, newMaterials);
   meshes.push(mesh);
 }

  viewer.IFC.loader.ifcManager.removeSubset(modelID, undefined, customID);
  return meshes;
}



// viewer.IFC.loader.ifcManager.useWebWorkers(true, 'files/IFCWorker.js');
viewer.IFC.setWasmPath('files/');

viewer.IFC.loader.ifcManager.applyWebIfcConfig({
  USE_FAST_BOOLS: true,
  COORDINATE_TO_ORIGIN: true
});

viewer.context.renderer.postProduction.active = true;

// Setup loader

// const lineMaterial = new LineBasicMaterial({ color: 0x555555 });
// const baseMaterial = new MeshBasicMaterial({ color: 0xffffff, side: 2 });

let first = true;
let model;

const loadIfc = async (event) => {

  // tests with glTF
  // const file = event.target.files[0];
  // const url = URL.createObjectURL(file);
  // const result = await viewer.GLTF.exportIfcFileAsGltf({ ifcFileUrl: url });
  //
  // const link = document.createElement('a');
  // link.download = `${file.name}.gltf`;
  // document.body.appendChild(link);
  //
  // for(const levelName in result.gltf) {
  //   const level = result.gltf[levelName];
  //   for(const categoryName in level) {
  //     const category = level[categoryName];
  //     link.href = URL.createObjectURL(category.file);
  //     link.click();
  //   }
  // }
  //
  // link.remove();
  const selectedFile = event.target.files[0];
  if(!selectedFile) return;

  const overlay = document.getElementById('loading-overlay');
  const progressText = document.getElementById('loading-progress');

  overlay.classList.remove('hidden');
  progressText.innerText = `Loading`;

  viewer.IFC.loader.ifcManager.setOnProgress((event) => {
    const percentage = Math.floor((event.loaded * 100) / event.total);
    progressText.innerText = `Loaded ${percentage}%`;
  });

  viewer.IFC.loader.ifcManager.parser.setupOptionalCategories({
    [IFCSPACE]: false,
    [IFCOPENINGELEMENT]: false
  });

  model = await viewer.IFC.loadIfc(selectedFile, false);
  console.log('Loaded: ' + model.modelID);
  window.models.push(model);
  window.modelIds.push(model.modelID);
  // model.material.forEach(mat => mat.side = 2);

  if(first) first = false
  else {
    ClippingEdges.forceStyleUpdate = true;
  }

  // await createFill(model.modelID);
  // viewer.edges.create(`${model.modelID}`, model.modelID, lineMaterial, baseMaterial);

  await viewer.shadowDropper.renderShadow(model.modelID);

  overlay.classList.add('hidden');

};

const inputElement = document.createElement('input');
inputElement.setAttribute('type', 'file');
inputElement.classList.add('hidden');
inputElement.addEventListener('change', loadIfc, false);

const handleKeyDown = async (event) => {
  if (event.code === 'Delete') {
    viewer.clipper.deletePlane();
    viewer.dimensions.delete();
  }
  if (event.code === 'Escape') {
    viewer.IFC.selector.unHighlightIfcItems();
  }
  if (event.code === 'KeyC') {
    viewer.context.ifcCamera.toggleProjection();
  }
  if (event.code === 'KeyD') {
    viewer.IFC.removeIfcModel(0);
  }
};

window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
window.onkeydown = handleKeyDown;
window.ondblclick = async () => {

  if (viewer.clipper.active) {
    viewer.clipper.createPlane();
  } else {
    const result = await viewer.IFC.selector.highlightIfcItem(true);
    if (!result) return;
    const { modelID, id } = result;
    const props = await viewer.IFC.getProperties(modelID, id, true, false);
    console.log('clicked on item with id: ' + id + ' from modelId ' + modelID);
    console.log(props);
    postToViewerHandlerJs(id, props);
  }
};

function postToViewerHandlerJs(id, data) {
  const url = 'http://127.0.0.1:8080/services/js/IFC%20Viewer/viewer_handler.mjs';
  const username = 'admin';
  const password = 'admin';
  
  const authHeader = 'Basic ' + btoa(username + ':' + password);
  
  const requestData = {
    id: id,
    data: data
  };

  console.log('IVO!!: posting to handlerjs' + requestData);
  
  fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  })
    .then(response => response.json())
    .then(data => {
      // Handle the response data
      console.log('IVO!!: ' + data);
    })
    .catch(error => {
      // Handle any errors
      console.error('IVO!!: ' + error);
    });
}

//Setup UI
const loadButton = createSideMenuButton('./resources/folder-icon.svg');
loadButton.addEventListener('click', () => {
  loadButton.blur();
  inputElement.click();
});

const sectionButton = createSideMenuButton('./resources/section-plane-down.svg');
sectionButton.addEventListener('click', () => {
  sectionButton.blur();
  viewer.clipper.toggle();
});

const dropBoxButton = createSideMenuButton('./resources/dropbox-icon.svg');
dropBoxButton.addEventListener('click', () => {
  dropBoxButton.blur();
  viewer.dropbox.loadDropboxIfc();
});

// const showOnlyWallsButton = createSideMenuButton('./resources/dropbox-icon.svg');
// var visibleSubsets = [];
// showOnlyWallsButton.addEventListener('click', async () => {
//   showOnlyWallsButton.blur();

//   if(visibleSubsets.length === 0) {
//       var ifcWallStandardCaseSubset = await newSubsetOfType(3512223829);
//       var ifcBuildingElementPartSubset = await newSubsetOfType(2979338954);
//       visibleSubsets.push(ifcWallStandardCaseSubset);
//       visibleSubsets.push(ifcBuildingElementPartSubset);
//       window.models[0].visible = false;
//   }
//   else {
//     visibleSubsets.forEach((ss) => {
//       window.ifc.subsets.removeSubset(ss.modelID, ss.material, ss.customID);
//     });
//     visibleSubsets = [];
//     window.models[0].visible = true;
//   }
// });

function createSideMenuButtoWithText(text){
  const button = document.createElement('button');
  button.classList.add('basic-button');

  const p = document.createElement("p");
  p.innerHTML = text;
  p.classList.add('icon');
  button.appendChild(p);

  const sideMenu = document.getElementById('side-menu-left');
  sideMenu.appendChild(button);

  return button;
}

window.buttonVisibleSubsets = new Map();
window.createToggleButtonByTypes = function(types, text) {
  const toggleButton = createSideMenuButtoWithText(text);

  toggleButton.addEventListener('click', async () => {
    toggleButton.blur();
    
    if(!window.buttonVisibleSubsets.has(toggleButton)) {
      const visibleSubsets = [];
      types.forEach(async (t) => {
        const visibleSubset = await newSubsetOfType(t);
        visibleSubsets.push(visibleSubset);
      });
      window.buttonVisibleSubsets.set(toggleButton, visibleSubsets);
      window.models[0].visible = false;
    }
    else {
      window.buttonVisibleSubsets.get(toggleButton).forEach((ss) => {
        //window.ifc.subsets.removeSubset(ss.modelID, ss.material, ss.customID);
        window.viewer.context.getScene().remove(ss);
      });
      window.buttonVisibleSubsets.delete(toggleButton);
      window.models[0].visible = true;
    }
  });
}

function createButtonsForTyes() {
  createToggleButtonByTypes([IFCWALL, IFCWALLSTANDARDCASE],"Walls");
  createToggleButtonByTypes([IFCSLAB],"Slabs");
  createToggleButtonByTypes([IFCWINDOW],"Windows");
  // add more for happy ^^
}
createButtonsForTyes();