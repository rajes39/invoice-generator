const handleCustomerImport = (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      // @ts-ignore - XLSX might be loaded dynamically
      const XLSX = window.XLSX;
      if (!XLSX) {
        showToast("SheetJS library not loaded. Please refresh and try again.", "error");
        return;
      }
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!jsonData || jsonData.length < 2) {
        showToast("Imported file is empty or missing headers.", "error");
        return;
      }

      const headers = jsonData[0].map((h: any) => String(h).trim().toLowerCase());
      
      const nameIdx = headers.findIndex(h => h === 'name' || h.includes('name') || h === 'customer' || h === 'client' || h === 'customer name');
      const mobileIdx = headers.findIndex(h => h === 'mobile' || h.includes('mobile') || h.includes('phone') || h.includes('contact') || h.includes('mobile number'));
      const gstIdx = headers.findIndex(h => h === 'gst' || h.includes('gst') || h.includes('gstin') || h.includes('tax'));
      const addressIdx = headers.findIndex(h => h === 'address' || h.includes('address') || h.includes('addr') || h === 'billing address');
      const stateIdx = headers.findIndex(h => h === 'state' || h.includes('state') || h.includes('region') || h === 'billing state');
      const rootIdx = headers.findIndex(h => h === 'root' || h.includes('root') || h.includes('branch'));
      const aadharIdx = headers.findIndex(h => h === 'aadhar' || h.includes('aadhar') || h.includes('uidai'));
      const panIdx = headers.findIndex(h => h === 'pan' || h.includes('pan'));

      if (nameIdx === -1) {
        showToast("Could not find Customer Name column in file.", "error");
        return;
      }

      const updatedList = [...customers];
      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0 || (row.length === 1 && !row[0])) {
          skippedCount++;
          continue;
        }
        
        const cName = row[nameIdx] ? String(row[nameIdx]).trim() : '';
        if (!cName) {
          skippedCount++;
          continue;
        }

        const cMobileStr = mobileIdx !== -1 && mobileIdx < row.length && row[mobileIdx] 
          ? String(row[mobileIdx]).trim().replace(/\D/g, '') 
          : '';
        const cMobile = cMobileStr.length === 10 ? cMobileStr : '';

        const cGst = gstIdx !== -1 && gstIdx < row.length && row[gstIdx] ? String(row[gstIdx]).trim().toUpperCase() : '';
        const cAddress = addressIdx !== -1 && addressIdx < row.length && row[addressIdx] ? String(row[addressIdx]).trim() : '';
        const cRoot = rootIdx !== -1 && rootIdx < row.length && row[rootIdx] ? String(row[rootIdx]).trim() : '';
        
        let cStateSelected = 'West Bengal';
        if (stateIdx !== -1 && stateIdx < row.length && row[stateIdx]) {
          const rawState = String(row[stateIdx]).trim().toLowerCase();
          const foundState = INDIAN_STATES.find(s => s.toLowerCase() === rawState || s.toLowerCase().includes(rawState));
          if (foundState) {
            cStateSelected = foundState;
          }
        }

        const cAadhar = aadharIdx !== -1 && aadharIdx < row.length && row[aadharIdx] ? String(row[aadharIdx]).trim().replace(/\D/g, '') : '';
        const cPan = panIdx !== -1 && panIdx < row.length && row[panIdx] ? String(row[panIdx]).trim().toUpperCase() : '';

        const existingCustomerIndex = cMobile
          ? updatedList.findIndex(c => c.mobile && c.mobile.trim() === cMobile)
          : -1;

        if (existingCustomerIndex !== -1) {
          updatedList[existingCustomerIndex] = {
            ...updatedList[existingCustomerIndex],
            name: cName,
            mobile: cMobile,
            gstin: cGst,
            address: cAddress,
            state: cStateSelected,
            root: cRoot || undefined,
            aadhar: cAadhar || undefined,
            pan: cPan || undefined
          };
          updatedCount++;
        } else {
          updatedList.push({
            id: `cust-import-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            name: cName,
            mobile: cMobile,
            gstin: cGst,
            address: cAddress,
            state: cStateSelected,
            root: cRoot || undefined,
            aadhar: cAadhar || undefined,
            pan: cPan || undefined
          });
          addedCount++;
        }
      }

      setCustomers(updatedList);

      if (addedCount === 0 && updatedCount === 0) {
        if (skippedCount > 0) {
          showToast(`Skipped ${skippedCount} blank or invalid rows during import.`, "info");
        } else {
          showToast("No valid customer records could be read.", "error");
        }
      } else {
        const summary = [
          addedCount > 0 ? `${addedCount} added` : null,
          updatedCount > 0 ? `${updatedCount} updated` : null,
          skippedCount > 0 ? `${skippedCount} skipped` : null,
        ].filter(Boolean).join(', ');
        showToast(`Customer import complete: ${summary}!`, "success");
      }
    } catch (err: any) {
      console.error("Import error:", err);
      showToast("Error importing file: " + err.message, "error");
    }
  };
  reader.onerror = () => {
    showToast("Failed to read file", "error");
  };
  reader.readAsArrayBuffer(file);
  e.target.value = ''; // Reset uploader
};