export class SelectedObject {
    public selectedObjects: any[] = [];

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