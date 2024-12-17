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
class Mouse {
    public isDragging = false;

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
    
}