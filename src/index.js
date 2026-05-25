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

// Dictionary mapping raw DCA status codes to readable text strings
const statusMap = {
  "20": "Current / Active",
  "50": "Expired",
  "1": "Active",
  // Fallback text will be applied if a code falls outside these common parameters
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
        return new Response(JSON.stringify({ error: "Missing required tracking parameters." }), { status: 400 });
      }

      const targetCode = boardMap[boardName];
      const clientCodeArray = targetCode ? [targetCode] : [];

      const dcaPayload = {
        searchMethod: "SNDX", 
        name: lastName.trim(), 
        clientCodeId: clientCodeArray,
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

      // Clean input variables for strict lookup matches
      const cleanFirst = firstName.trim().toLowerCase();
      const cleanLast = lastName.trim().toLowerCase();

      // Find the exact provider where both last name and first name are present in the DCA string
      const exactProvider = results.find(p => {
        const dcaNameLower = p.name.toLowerCase();
        return dcaNameLower.includes(cleanLast) && dcaNameLower.includes(cleanFirst);
      });

      let responsePayload;
      if (exactProvider) {
        // Translate the raw numeric status string to a readable text message
        const rawStatus = exactProvider.primaryStatusCode;
        const readableStatus = statusMap[rawStatus] || `Status Code ${rawStatus}`;

        // Clean up the ISO date timestamp into a readable date string
        let displayDate = "N/A";
        if (exactProvider.expirationDate) {
          displayDate = exactProvider.expirationDate.split('T')[0]; // Returns "YYYY-MM-DD"
        }

        responsePayload = {
          found: true,
          licenseNumber: exactProvider.licenseNumber,
          status: readableStatus,
          expiration: displayDate
        };
      } else {
        responsePayload = {
          found: false,
          licenseNumber: "NOT FOUND",
          status: "N/A",
          expiration: "N/A"
        };
      }

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
};
