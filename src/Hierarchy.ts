class Hierarchy {
    private container: HTMLElement;

    constructor(containerId: string) {
      this.container = document.getElementById(containerId) as HTMLElement;
    }
  
    // Method to set hierarchy (for now, mock data or extracted from the Scene)
    setHierarchy(hierarchyData) {
      this.container.innerHTML = ''; // Clear previous data
  
      hierarchyData.forEach((node) => {
        const div = document.createElement('div');
        div.textContent = node.name;
        div.style.marginLeft = `${node.level * 20}px`; // Indentation for hierarchy
        this.container.appendChild(div);
      });
    }
  }
  
  export default Hierarchy;
  