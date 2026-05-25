// Dictionary mapping Lark text choices to official DCA clientCode numbers
const boardMap = {
  "Vocational Nursing and Psychiatric Technicians, Board of": 430,
  "Registered Nursing, Board of": 400,
  "Respiratory Care Board": 700,
  "Physician Assistant Board": 950,
  "Physical Therapy Board of California": 720,
  "Occupational Therapy, California Board of": 710,
  "Medical Board of California": 800,
  "Behavioral Sciences, Board of": 200
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
    }

    try {
      const body = await request.json();
      const { firstName, lastName, boardName } = body;

      if (!firstName || !lastName || !boardName) {
        return new Response(JSON.stringify({ error: "Missing firstName, lastName, or boardName" }), { status: 400 });
      }

      // Convert Lark text to DCA code. Fallback to empty array if no match found.
      const targetCode = boardMap[boardName];
      const clientCodeArray = targetCode ? [targetCode] : [];

      const dcaPayload = {
        searchMethod: "SNDX", 
        name: lastName.trim(), 
        clientCodeId: clientCodeArray, // Dynamic board code array passes here
        licenseNumbers: [], statusId: [], city: [], county: []
      };

      const dcaResponse = await fetch(
        "https://iservices.dca.ca.gov/api/search/v1/licenseSearchService/getPublicLicenseSearch",
        {
          method: "POST",
          headers: {
            "accept": "application/json",
            "Content-Type": "application/json",
            "APP_ID": env.DCA_APP_ID,
            "APP_KEY": env.DCA_APP_KEY
          },
          body: JSON.stringify(dcaPayload)
        }
      );

      const dcaData = await dcaResponse.json();
      const results = dcaData.results || [];

      // Loop through matches to verify the First Name aligns
      const exactProvider = results.find(p => 
        p.name.toLowerCase().includes(firstName.trim().toLowerCase())
      );

      let responsePayload = exactProvider ? {
        found: true,
        licenseNumber: exactProvider.licenseNumber,
        status: exactProvider.primaryStatusCode,
        expiration: exactProvider.expirationDate || "N/A"
      } : {
        found: false,
        licenseNumber: "NOT FOUND",
        status: "N/A",
        expiration: "N/A"
      };

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
};
