import {
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Color,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PointLight,
  GridHelper,
  AxesHelper,
  EquirectangularReflectionMapping,
  Box3,
  Vector3,
  Object3D,
  Vector2,
  Raycaster,
  Mesh,
} from "three";
import hdrUrl from "./textures/neutral.hdr";
import { GUI } from "dat.gui";
import {
  GLTFLoader,
  OrbitControls,
  RGBELoader,
} from "three/examples/jsm/Addons.js";

export class ModelViewer {
  public container: HTMLElement;
  public hierarchyContainer: HTMLElement;
  public modelViewerContainer: HTMLElement;

  public model?: Group;
  public uuidsButton?: HTMLButtonElement;
  public isHierarchyVisible = true;
  public isDragging = false;

  public scene = new Scene();
  public camera = new PerspectiveCamera();
  public renderer = new WebGLRenderer({ antialias: true });
  public controls = new OrbitControls(this.camera, this.renderer.domElement);

  public selectedObjects: any[] = [];
  public originalMaterials: any[] = [];

  public resizer: HTMLElement;
  public resizeObserver: ResizeObserver;

  public UUID_DIV_MAP: Map<string, HTMLElement> = new Map();

  constructor(idOrEl: HTMLElement | string) {
    const container =
      typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;

    if (!container) {
      throw new Error(`Container with id ${idOrEl} not found.`);
    }

    container.classList.add("sfera-3d-model-viewer");

    this.container = container;

    this.hierarchyContainer = document.createElement("div");
    this.resizer = document.createElement("div");
    this.modelViewerContainer = document.createElement("div");

    this.hierarchyContainer.classList.add("hierarchy-container");
    this.resizer.classList.add("resizer");
    this.modelViewerContainer.classList.add("model-viewer-container");

    this.container.appendChild(this.hierarchyContainer);
    this.container.appendChild(this.resizer);
    this.container.appendChild(this.modelViewerContainer);
    this.container.classList.add("container");

    // Setup resize observer to watch changes in container size
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);

    this.initResizer();
    this.setCamera();
    this.setControls();
    this.addHierarchyButton();
    this.addUUIDButton();
    this.init();
  }

  initResizer() {
    const containerRect = this.container.getBoundingClientRect();
    if (!this.isHierarchyVisible) {
      this.hierarchyContainer.style.width = `0px`;
      this.modelViewerContainer.style.width = `${containerRect.width}px`;
      this.onResize();
      this.updateCanvasWidth();
    }

    let isResizing = false;
    this.resizer.addEventListener("mousedown", () => {
      isResizing = true;
      document.body.style.cursor = "col-resize";
    });

    window.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const containerRect = this.container.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const minWidth = 120;
      const maxWidth = 300;
      if (newWidth > minWidth && newWidth < maxWidth) {
        this.hierarchyContainer.style.width = `${newWidth}px`;
        this.modelViewerContainer.style.width = `${containerRect.width - newWidth
          }px`;
      }
      this.onResize();
      this.updateCanvasWidth();
    });

    window.addEventListener("mouseup", () => {
      isResizing = false;
      document.body.style.cursor = "";
    });
  }

  init() {
    this.renderer.setSize(
      this.modelViewerContainer.clientWidth,
      this.modelViewerContainer.clientHeight,
    );
    this.renderer.shadowMap.enabled = true;
    //console.log(this.renderer);
    //console.log(this.renderer.outputColorSpace);

    this.modelViewerContainer.appendChild(this.renderer.domElement);

    // Set camera position
    this.camera.position.set(0, 2, 10);

    // Set scene
    //this.setHelpers();
    //this.addLight();
    this.addTextureLight();

    this.selectAll();
    this.modelViewerContainer.addEventListener(
      "mousedown",
      this.onMouseDown.bind(this),
      false,
    );
    this.modelViewerContainer.addEventListener(
      "mousemove",
      this.onMouseMove.bind(this),
      false,
    );
    this.modelViewerContainer.addEventListener(
      "mouseup",
      this.onMouseUp.bind(this),
      false,
    );

    // Start rendering
    this.animate();
    this.render();
  }

  private updateCanvasWidth(): void {
    // Select the canvas element with the specific data attribute
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[data-engine="three.js r169"]',
    );
    if (canvas) {
      // Check if canvas exists
      const modelViewerContainerWidth = this.modelViewerContainer.clientWidth; // Get the width of the model viewer container
      canvas.width = modelViewerContainerWidth;
      canvas.style.width = `${modelViewerContainerWidth}px`;
      //console.log(`Canvas width set to: ${canvas.width} and style width set to: ${canvas.style.width}`);
    } else {
      console.error("Canvas not found.");
    }
  }

  onMouseDown() {
    this.isDragging = false;
  }

  onMouseMove() {
    this.isDragging = true;
  }

  onMouseUp() {
    if (this.isDragging) {
      console.log("Camera moved, prevent selection.");
      return;
    }
    this.handleModelClick(event);
  }

  setCamera() {
    this.camera.fov = 60;
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.layers.enable(0);
    this.camera.layers.enable(1);
    this.camera.layers.disable(2);
  }

  setControls() {
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 1000;
    this.controls.screenSpacePanning = true;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.target.set(0, 0, 0);
  }

  onResize() {
    const width = this.modelViewerContainer.clientWidth;
    const height = this.modelViewerContainer.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  addLight() {
    this.scene.background = new Color(0xf8f8f8);
    const ambientLight = new AmbientLight(0xffffff, 1.0); // Higher intensity for more visibility
    this.scene.add(ambientLight);

    // Key Light - Primary directional light with high intensity
    const keyLight = new DirectionalLight(0xffffff, 2.0); // Stronger lighting
    keyLight.position.set(10, 20, 10);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    // Fill Light - Reduced shadow areas with increased intensity
    const fillLight = new DirectionalLight(0xffffff, 1); // High intensity to balance shadows
    fillLight.position.set(-10, 20, 10);
    fillLight.castShadow = true;
    this.scene.add(fillLight);

    // Back Light - Highlight the edges with increased intensity
    const backLight = new DirectionalLight(0xffffff, 1); // Higher intensity for a strong outline
    backLight.position.set(10, 20, -10);
    backLight.castShadow = true;
    this.scene.add(backLight);

    // Hemisphere Light - Increase intensity for sky-ground contrast
    const hemiLight = new HemisphereLight(0xaaaaaa, 0x444444, 1); // Enhanced visibility and realism
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Point Light - Additional strong highlights
    const pointLight = new PointLight(0xffffff, 2.0, 30); // Higher intensity for strong highlights
    pointLight.position.set(0, 15, 15);
    pointLight.castShadow = true;
    this.scene.add(pointLight);

    const gui = new GUI();
    const lightSettings = {
      lightIntensity: keyLight.intensity, // Create one setting for overall light intensity
    };

    // Create one slider in the GUI for controlling all lights' intensities
    gui
      .add(lightSettings, "lightIntensity", 0, 5)
      .name("Light")
      .onChange((value) => {
        keyLight.intensity = value;
        fillLight.intensity = value;
        backLight.intensity = value;
      });
  }

  setHelpers() {
    const gridHelper = new GridHelper(10, 10);
    this.scene.add(gridHelper);
    const axesHelper = new AxesHelper(5);
    this.scene.add(axesHelper);
    gridHelper.layers.set(1);
    axesHelper.layers.set(1);
  }

  disableCameraControls() {
    this.controls.enabled = false;
  }

  enableCameraControls() {
    this.controls.enabled = true;
  }

  addTextureLight() {
    this.scene.background = new Color(0xf8f8f8);
    const rgbeLoader = new RGBELoader();

    rgbeLoader.load(hdrUrl, (texture) => {
      texture.mapping = EquirectangularReflectionMapping;
      this.scene.environment = texture;
    });

    const gui = new GUI({ autoPlace: false });
    const lightSettings = {
      envMapIntensity: 1,
    };

    gui
      .add(lightSettings, "envMapIntensity", 0, 1)
      .name("Light")
      .onChange((value) => {
        this.scene.environmentIntensity = 0.5 * value + 0.5;
        this.disableCameraControls();
      })
      .onFinishChange(() => {
        this.enableCameraControls();
      });

    gui.domElement.classList.add("custom-gui");
    this.modelViewerContainer.appendChild(gui.domElement);

    /*const planeGeometry = new THREE.PlaneGeometry(500, 500);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xf8f8f8 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.layers.set(0);
    
    // Rotate the plane to be horizontal
    plane.rotation.x = -Math.PI / 2;
    
    // Enable shadow receiving
    plane.receiveShadow = true;

    // Add the plane to the scene
    this.scene.add(plane);*/
  }

  loadModel(url: string) {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      url,
      (gltf) => {
        this.model = gltf.scene;
        this.scene.add(this.model);
        this.centerModel(this.model);
        this.fitObjectToView(this.camera, this.model, this.controls);
        this.setOriginalMaterialsFromGLB(gltf);
        this.traverseHierarchy(this.model, this.hierarchyContainer, 0);
        //console.log(this.UUID_DIV_MAP);
        this.render();
      },
      undefined,
      (error) => {
        console.error("An error happened", error);
      },
    );
  }
  /*createUuidDivMapping(
    scene: Object3D,
    hierarchyContainer: HTMLElement
  ): Map<string, HTMLElement> {
    const uuidDivMap = new Map<string, HTMLElement>(); // Map for UUID-DIV pairs
  
    // Step 1: Traverse the THREE.js scene to collect meshes
    const meshes: any [] = [];
    scene.traverse((child: Object3D) => {
      if (child) {
        meshes.push(child);
      }
      //console.log(meshes);
    });
  
    // Step 2: Traverse the DOM hierarchy
    const hierarchyItems = Array.from(
      hierarchyContainer.querySelectorAll(".hierarchy-item")
    ) as HTMLElement[];
  
    // Step 3: Match meshes to divs and populate the map
    hierarchyItems.forEach((div: HTMLElement) => {
      const nameElement = div.querySelector(".hierarchy-item-name") as HTMLElement;
      if (nameElement) {
        const itemName = nameElement.textContent?.trim();
        const matchingMesh = meshes.find((mesh) => mesh.name === itemName);
  
        if (matchingMesh) {
          uuidDivMap.set(matchingMesh.uuid, div); // Bind the UUID to the div
        }
      }
    });

    return uuidDivMap;
  }*/

  centerModel(model: any) {
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    model.position.x = -center.x;
    model.position.y = 0;
    model.position.z = -center.z;
  }

  fitObjectToView(camera: PerspectiveCamera, object: Object3D, controls: any) {
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    cameraDistance *= 1.5;
    const direction = new Vector3()
      .subVectors(camera.position, center)
      .normalize();
    camera.position.copy(center).add(direction.multiplyScalar(cameraDistance));
    camera.lookAt(center);

    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
    camera.updateProjectionMatrix();
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  traverseHierarchy(object: any, parentElement: HTMLElement, level: number) {
    object.children.forEach((child: any) => {
      const childItem = document.createElement("div");
      childItem.className = "hierarchy-item";
      childItem.style.display = "flex";
      childItem.style.justifyContent = "space-between";
      childItem.style.alignItems = "center";

      const hasChildren = child.children.length > 0;
      const indentContainer = document.createElement("span");
      indentContainer.innerHTML = "\u00A0".repeat(level * 5);
      const { objectName, eyeButton } = this.createObjectNameAndEyeButton(
        child,
        "",
      );
      const childContainer = document.createElement("div");
      childContainer.className = "child-container";
      childContainer.style.marginLeft = "\u00A0".repeat(level * 5);
      childContainer.style.display = level === 0 ? "block" : "none";

      const leftContainer = document.createElement("div");
      leftContainer.style.display = "flex";
      leftContainer.style.alignItems = "center";

      if (hasChildren) {
        const expandButton = document.createElement("button");
        expandButton.className = "expand-button";
        const isExpanded = childContainer.style.display === "block";
        expandButton.innerHTML = isExpanded
          ? '<i class="material-icons">keyboard_arrow_down</i>'
          : '<i class="material-icons">keyboard_arrow_right</i>';
        expandButton.title = isExpanded
          ? "Collapse hierarchy"
          : "Expand hierarchy";

        expandButton.addEventListener("click", (event) => {
          event.stopPropagation();
          const isExpanded = childContainer.style.display === "block";
          childContainer.style.display = isExpanded ? "none" : "block";
          expandButton.innerHTML = isExpanded
            ? '<i class="material-icons">keyboard_arrow_right</i>'
            : '<i class="material-icons">keyboard_arrow_down</i>';
          expandButton.title = isExpanded
            ? "Expand hierarchy"
            : "Collapse hierarchy";
        });

        leftContainer.appendChild(indentContainer);
        leftContainer.appendChild(expandButton);
      } else {
        leftContainer.appendChild(indentContainer);
      }

      leftContainer.appendChild(objectName);
      childItem.appendChild(leftContainer);
      childItem.appendChild(eyeButton);
      parentElement.appendChild(childItem);
      parentElement.appendChild(childContainer);
      if (hasChildren) {
        this.traverseHierarchy(child, childContainer, level + 1);
      }
      this.UUID_DIV_MAP.set(child.uuid, childItem);
      this.handleDivClick(childItem, child);
    });
  }

  createObjectNameAndEyeButton(object: any, indent: string) {
    const objectName = document.createElement("div");
    objectName.textContent =
      indent + (object.name || "Unnamed Object") + "\u00A0".repeat(3);
    objectName.className = "hierarchy-item-name";

    const eyeButton = document.createElement("button");
    eyeButton.className = "eye-button";
    eyeButton.setAttribute("data-uuid", object.uuid);
    eyeButton.innerHTML = '<i class="material-icons">visibility</i>';
    eyeButton.title = "Toggle Visibility";

    eyeButton.addEventListener("click", (event) => {
      const targetElement = event.target as HTMLElement;
      if (targetElement.closest(".hierarchy-item.active")) {
        this.toggleObjectsVisibility(event, object);
      } else {
        this.toggleObjectVisibility(event, object);
      }
    });
    return { objectName, eyeButton };
  }

  toggleObjectsVisibility(event: Event, object: any) {
    event.stopPropagation();
    const isVisible = object.visible;
    const activeElements = document.querySelectorAll(".hierarchy-item.active");
    if (activeElements.length > 0) {
      activeElements.forEach((element) => {
        const eyeButton = element.querySelector(".eye-button");
        if (eyeButton && eyeButton.getAttribute("data-uuid")) {
          const uuid = eyeButton.getAttribute("data-uuid");
          const relatedObject = this.getObjectByUUID(uuid || "");
          if (relatedObject) {
            relatedObject.visible = !isVisible;
            const targetLayer = relatedObject.visible ? 0 : 2;
            relatedObject.layers.set(targetLayer);
            eyeButton.innerHTML = relatedObject.visible
              ? '<i class="material-icons">visibility</i>'
              : '<i class="material-icons">visibility_off</i>';
            this.toggleParentVisibility(relatedObject);
          }
        }
      });
    }
  }

  getObjectByUUID(uuid: string) {
    return this.scene.getObjectByProperty("uuid", uuid);
  }

  toggleObjectVisibility(event: Event, object: any) {
    event.stopPropagation();
    object.visible = !object.visible;
    object.layers.set(0);
    this.toggleChildrenVisibility(object);
    this.toggleParentVisibility(object);
    this.render();
  }

  toggleParentVisibility(object: any) {
    const parent = object.parent;
    if (parent) {
      const anyVisible = parent.children.some(
        (sibling: any) => sibling.visible,
      );

      if (!anyVisible) {
        parent.visible = false;
      } else {
        parent.visible = true;
      }

      const correspondingButton = document.querySelector(
        `.eye-button[data-uuid="${parent.uuid}"]`,
      );
      if (correspondingButton) {
        correspondingButton.innerHTML = parent.visible
          ? '<i class="material-icons">visibility</i>'
          : '<i class="material-icons">visibility_off</i>';
      }
      this.toggleParentVisibility(parent);
    }
  }

  toggleChildrenVisibility(object: any) {
    const activeElements = document.querySelectorAll(".hierarchy-item.active");
    const targetLayer = object.visible ? 0 : 2;
    object.traverse((descendant: any) => {
      descendant.visible = object.visible;
      descendant.layers.set(targetLayer);
      const correspondingButton = document.querySelector(
        `.eye-button[data-uuid="${descendant.uuid}"]`,
      );
      if (correspondingButton) {
        correspondingButton.innerHTML = object.visible
          ? '<i class="material-icons">visibility</i>'
          : '<i class="material-icons">visibility_off</i>';
      }
      const foundDiv = this.findDivByUUID(descendant.uuid, this.UUID_DIV_MAP);
      if (foundDiv) {
        if (object.visible) {
          if (Array.from(activeElements).includes(foundDiv)) {
            foundDiv.classList.add("active");
          }
        } else {
          if (!Array.from(activeElements).includes(foundDiv)) {
            foundDiv.classList.remove("active");
          }
        }
      }
    });
  }

  handleModelClick(event: any) {
    if (
      event.target.closest(".buttons") ||
      event.target.closest(".eye-button")
    ) {
      return;
    }
    const rect = this.modelViewerContainer.getBoundingClientRect();
    const mouse = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const raycaster = new Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    const intersects = raycaster.intersectObjects(this.scene.children, true);

    const isCmdOrCtrlPressed = event.metaKey || event.ctrlKey;

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;

      const itemElement = this.findDivByUUID(clickedObject.uuid, this.UUID_DIV_MAP);
      //console.log("Clicked:" + clickedObject.uuid);
      if (itemElement && itemElement.classList.contains("active")) {
        if (!isCmdOrCtrlPressed) {
          this.deselectAll();
          this.selectObject(clickedObject, itemElement);
        } else {
          this.deselectObjectAndItsChildren(itemElement, clickedObject);
        }
      } else {
        if (!isCmdOrCtrlPressed) {
          this.deselectAll();
        }
        this.selectObject(clickedObject, itemElement);
      }
    } else {
      this.deselectAll();
    }
  }

  selectObject(clickedObject: any, itemElement: HTMLElement | null) {
    this.changeMaterialColor(clickedObject.uuid);
    this.addToUUIDS(clickedObject);
    if (itemElement) {
      itemElement.classList.add("active");
      this.rollToHierarchyItem(itemElement);
      itemElement.scrollIntoView({ block: "center" });
      //itemElement.focus({ preventScroll: true });
    }
  }

  handleDivClick(itemElement: HTMLElement, object: any) {
    itemElement.addEventListener("click", (event: any) => {
      const isEyeButton = event.target.closest(".eye-button");
      if (isEyeButton) {
        return;
      }
      const isActive = itemElement.classList.contains("active");
      const isCmdOrCtrlPressed = event.metaKey || event.ctrlKey;
      if (isActive) {
        if (!isCmdOrCtrlPressed) {
          this.deselectAll();
          this.selectObjectAndItsChildren(itemElement, object);
        } else {
          this.deselectObjectAndItsChildren(itemElement, object);
        }
      } else {
        if (!isCmdOrCtrlPressed) {
          this.deselectAll();
        }
        this.selectObjectAndItsChildren(itemElement, object);
      }
    });
  }

  deselectAll() {
    this.removeActiveAll();
    this.resetMaterialAll();
    this.makeEmptyUUIDS();
  }

  rollToHierarchyItem(div: HTMLElement) {
    let currentDiv: HTMLElement | null = div;
    while (currentDiv) {
      const parentDiv = currentDiv.parentElement?.previousElementSibling;
      if (parentDiv && parentDiv.classList.contains("hierarchy-item")) {
        const expandButton = parentDiv.querySelector<HTMLElement>(".expand-button");
        //console.log(expandButton)
        if (expandButton) {
          expandButton.innerHTML = '<i class="material-icons">keyboard_arrow_down</i>';
          expandButton.title = "Collapse hierarchy";
        }
        const childContainer = parentDiv.nextElementSibling;
        if (childContainer && childContainer instanceof HTMLElement) {
          childContainer.style.display = "block"; // Ensure the child container is expanded
        }
        currentDiv = parentDiv as HTMLElement;
      } else {
        break; // Stop if no valid parentDiv found
      }
    }
  }

  resetMaterial(object: any) {
    if (object.isMesh) {
      const originalMaterial = this.originalMaterials[object.name];
      if (originalMaterial) {
        object.material = originalMaterial;
      }
    }
  }

  selectObjectAndItsChildren(itemElement: HTMLElement, object: any) {
    if (!itemElement || !object) return;
    itemElement.classList.add("active");
    this.changeMaterialColor(object.uuid);
    this.addToUUIDS(object);

    object.traverse((childObject: any) => {
      if (childObject !== object) {
        const childItemElement = this.findDivByUUID(childObject.uuid, this.UUID_DIV_MAP);
        if (childItemElement) {
          childItemElement.classList.add("active");
          this.changeMaterialColor(childObject.uuid);
          this.addToUUIDS(childObject);
        }
      }
    });
  }

  deselectObjectAndItsChildren(itemElement: HTMLElement, object: any) {
    if (!itemElement || !object) return;
    itemElement.classList.remove("active");
    this.resetMaterial(object);
    this.removeFromUUIDS(object);

    object.traverse((childObject: any) => {
      if (childObject !== object) {
        const childItemElement = this.findDivByUUID(childObject.uuid, this.UUID_DIV_MAP);
        if (childItemElement) {
          childItemElement.classList.remove("active");
          this.resetMaterial(childObject);
          this.removeFromUUIDS(childObject);
        }
      }
    });
  }

  addHierarchyButton() {
    const hierarchyButton = document.createElement("button");
    hierarchyButton.classList.add("hierarchyButton");
    hierarchyButton.classList.add("buttons");
    hierarchyButton.textContent = "Hierarchy";
    hierarchyButton.title = "Show hierarchy";
    this.container.appendChild(hierarchyButton);
    hierarchyButton.addEventListener("click", () => this.toggleHierarchy());
  }

  toggleHierarchy() {
    if (this.isHierarchyVisible) {
      this.hierarchyContainer.style.display = "none";
      this.hierarchyContainer.innerHTML = "";
      this.isHierarchyVisible = false;
    } else {
      this.hierarchyContainer.style.display = "block";
      this.traverseHierarchy(this.model, this.hierarchyContainer, 0);
      this.hierarchyContainer.style.width = "300px";
      this.onResize();
      this.updateCanvasWidth();
      this.isHierarchyVisible = true;
    }
    this.initResizer();
  }

  addUUIDButton() {
    this.uuidsButton = document.createElement("button");
    this.uuidsButton.classList.add("buttons", "uuidsButton");
    this.uuidsButton.textContent = "UUIDs";
    this.uuidsButton.title = "Print UUIDs of selected objects to the console";

    this.container.appendChild(this.uuidsButton);
    this.uuidsButton.addEventListener("click", () => this.printSelectedUUIDs());
  }

  removeActiveAll() {
    const items = document.querySelectorAll(".hierarchy-item");
    items.forEach((item) => {
      item.classList.remove("active");
    });
  }

  makeActiveAll() {
    const items = document.querySelectorAll(".hierarchy-item");
    items.forEach((item) => {
      item.classList.add("active");
    });
  }

  setOriginalMaterialsFromGLB(glb: any) {
    glb.scene.traverse((child: any) => {
      if (child.isMesh) {
        this.originalMaterials[child.name] = child.material;
      }
    });
  }

  resetMaterialAll() {
    if (Object.keys(this.originalMaterials).length > 0) {
      this.model?.traverse((child: any) => {
        if ((child as any).isMesh) {
          const originalMaterial = this.originalMaterials[child.name];
          if (originalMaterial) {
            (child as any).material = originalMaterial;
          }
        }
      });
    }
  }

  addToUUIDS(object: any) {
    if (!this.selectedObjects.includes(object)) {
      this.selectedObjects.push(object);
    }
  }

  removeFromUUIDS(object: any) {
    const index = this.selectedObjects.indexOf(object);

    if (index !== -1) {
      this.selectedObjects.splice(index, 1);
    }
  }

  makeEmptyUUIDS() {
    this.selectedObjects.length = 0;
  }

  /*findDivByUUID(uuid: string): HTMLElement | null {
    let foundObject: Object3D | null = null;

    this.model?.traverse((child: Object3D) => {
      if (child.uuid === uuid) {
        foundObject = child;
        //console.log(foundObject);
      }
    });
    if (!foundObject) {
      console.warn(`Object with UUID ${uuid} not found.`);
      return null;
    }
    const hierarchyItems = Array.from(
      document.querySelectorAll(".hierarchy-item"),
    ) as HTMLElement[];
    const foundItem = hierarchyItems.find((item: HTMLElement) => {
      const itemNameElement = item.querySelector<HTMLElement>(
        ".hierarchy-item-name",
      );
      if (itemNameElement) {
        const itemText = itemNameElement.textContent || "";

        const normalizedItemText = itemText.replace(/\s+/g, " ").trim();
        const normalizedObjectName =
          foundObject?.name.replace(/\s+/g, " ").trim() || "";
        return normalizedItemText.includes(normalizedObjectName);
      }
      return false;
    });
    return foundItem || null;
  }*/

  findDivByUUID(uuid: string, uuidDivMap: Map<string, HTMLElement>): HTMLElement | null {
    // Check if the UUID exists in the map
    const foundDiv = uuidDivMap.get(uuid);
    if (!foundDiv) {
      console.warn(`No div found for UUID: ${uuid}`);
      return null;
    }
    //console.log(`Div found for UUID: ${uuid}`, foundDiv);
    return foundDiv;
  }

  changeMaterialColor(uuid: string) {
    const objectToHighlight = this.scene.getObjectByProperty("uuid", uuid);
    let originalMaterial = (objectToHighlight as any).material;
    if (originalMaterial != null) {
      //console.log(originalMaterial);
      const highlightMaterial = originalMaterial.clone();
      highlightMaterial.color.set(0x3d3c77);
      //highlightMaterial.emissive.set(0x3d3c77);
      //highlightMaterial.emissiveIntensity = 0.3;
      this.render();
      //console.log(highlightMaterial);
      (objectToHighlight as any).material = highlightMaterial;
    }
  }

  changeMaterialColorAll() {
    this.model?.traverse((object) => {
      if ((object as any).isMesh) {
        const highlightMaterial = (object as any).material.clone();
        highlightMaterial.color.set(0x3d3c77);
        highlightMaterial.emissive.set(0x3d3c77);
        (object as any).material = highlightMaterial;
      }
    });
  }

  selectAll() {
    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key === "a") {
        event.preventDefault();
        this.makeActiveAll();
        this.changeMaterialColorAll();
        this.makeEmptyUUIDS();
        this.model?.traverse((child) => {
          this.addToUUIDS(child);
        });
      }
    });
  }

  printSelectedUUIDs() {
    if (this.selectedObjects.length === 0) {
      console.log("No objects selected.");
      return;
    }
    console.log("Selected Object UUIDs:");
    this.selectedObjects.forEach((obj) => {
      console.log(`UUID ${obj.uuid} of mesh ${obj.name}`);
    });
  }
}
