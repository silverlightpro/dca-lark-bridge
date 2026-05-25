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
      const { firstName, lastName } = body;

      if (!firstName || !lastName) {
        return new Response(JSON.stringify({ error: "Missing names" }), { status: 400 });
      }

      const dcaPayload = {
        searchMethod: "SNDX", 
        name: lastName.trim(), 
        clientCodeId: [800], 
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
