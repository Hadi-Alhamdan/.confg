// js/dataManagement.js 
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('export-data-btn');
    const importFileInput = document.getElementById('import-file-input');
    const importBtn = document.getElementById('import-data-btn');
    const importStatusEl = document.getElementById('import-status');

    let fileToImport = null;

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const blob = await exportData(); // from api.js
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `productivity_app_backup_${new Date().toISOString().slice(0,10)}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
                alert("Data export started. Check your downloads.");
            } catch (error) {
                console.error("Export failed:", error);
                // Alert is already handled by api.js if it's an API error
            }
        });
    }

    if (importFileInput) {
        importFileInput.addEventListener('change', (event) => {
            fileToImport = event.target.files[0];
            if (fileToImport) {
                importBtn.disabled = false;
            } else {
                importBtn.disabled = true;
            }
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            if (!fileToImport) {
                alert("Please select a file to import.");
                return;
            }
            if (!confirm("Are you sure you want to import? This will overwrite ALL existing data.")) {
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    importStatusEl.textContent = "Importing data...";
                    importStatusEl.className = "status-message";
                    importStatusEl.style.display = 'block';

                    const result = await importData(jsonData); // from api.js
                    
                    importStatusEl.textContent = result.message || "Import successful! Please refresh the application.";
                    importStatusEl.classList.add('success');
                    alert("Data imported successfully! Please refresh the application to see changes.");
                    // Optionally, trigger a full app reload or data refresh for all views
                    // document.body.dispatchEvent(new CustomEvent('dataImported'));
                    // location.reload(); // Simplest way to ensure all data is fresh
                } catch (parseError) {
                    console.error("Error parsing JSON file or importing:", parseError);
                    importStatusEl.textContent = `Import Error: ${parseError.message}`;
                    importStatusEl.classList.add('error');
                    alert(`Import Error: ${parseError.message}`);
                } finally {
                    importFileInput.value = ''; // Reset file input
                    fileToImport = null;
                    importBtn.disabled = true;
                    setTimeout(() => { importStatusEl.style.display = 'none';}, 5000);
                }
            };
            reader.readAsText(fileToImport);
        });
    }
    
     // Initialize this page if it becomes visible (similar to other pages)
     const dataMgmtSection = document.getElementById('data-management-section');
     if (dataMgmtSection) {
         // Simple initialization, no data to load initially
         const observer = new MutationObserver((mutationsList) => {
             for(const mutation of mutationsList) {
                 if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                     if (dataMgmtSection.style.display !== 'none') {
                         console.log("Data Management page shown.");
                         importFileInput.value = ''; // Reset file input
                         fileToImport = null;
                         importBtn.disabled = true;
                     }
                 }
             }
         });
         observer.observe(dataMgmtSection, { attributes: true });
     }

});