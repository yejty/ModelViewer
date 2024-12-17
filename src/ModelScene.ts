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
    Object3D
} from "three";
import {
    GLTFLoader,
    OrbitControls,
    RGBELoader,
}
    from "three/examples/jsm/Addons.js";
import { GUI } from "dat.gui";
import hdrUrl from "./textures/neutral.hdr";

export class ModelScene {
    public modelViewerContainer: HTMLElement;

    public scene = new Scene();
    public camera = new PerspectiveCamera();
    public renderer = new WebGLRenderer({ antialias: true });
    public model?: Group;
    public controls = new OrbitControls(this.camera, this.renderer.domElement);

    constructor(idOrEl: HTMLElement | string) {
        const modelViewerContainer =
            typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;

        if (!modelViewerContainer) {
            throw new Error(`Container with id ${idOrEl} not found.`);
        }

        modelViewerContainer.classList.add("sfera-3d-model-viewer");

        this.modelViewerContainer = modelViewerContainer;
        this.setCamera();
        this.setControls();
        this.addTextureLight();
        this.render();
        this.animate();
    }
    setCamera() {
        this.camera.fov = 60;
        this.camera.aspect = this.modelViewerContainer.clientWidth / this.modelViewerContainer.clientHeight;
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

    loadModel(urlOrPath: string) {
        const gltfLoader = new GLTFLoader();
        gltfLoader.load(
            urlOrPath,
            (gltf) => {
                this.model = gltf.scene;
                this.scene.add(this.model);
                this.centerModel(this.model);
                this.fitObjectToView(this.camera, this.model, this.controls);
                this.render();
            },
            undefined,
            (error) => {
                console.error("An error happened", error);
            },
        );
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

}