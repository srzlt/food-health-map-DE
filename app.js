document.addEventListener('DOMContentLoaded', () => {
            // Map initialization parameters
            const MAP_LATITUDE = 51.4332;
            const MAP_LONGITUDE = 7.6616;
            const MAP_ZOOM_LEVEL = 8;

            // Initialize the map and set its view to NRW, Germany
            var map = L.map('map').setView([MAP_LATITUDE, MAP_LONGITUDE], MAP_ZOOM_LEVEL);

            // Load and display tile layers on the map
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                crossOrigin: true
            }).on('tileerror', function(error) {
                console.error('Tile loading error:', error);
            }).addTo(map);

            // Ensure the map is properly loaded by invalidating its size
            map.whenReady(() => {
                map.invalidateSize();
            });

            // Function to scrape business data dynamically from multiple pages of the backend proxy server
            async function loadAllBusinessData() {
                let currentPage = 1;
                let totalPages = 1;
                const businesses = [];

                try {
                    const response = await fetch(`http://localhost:3000/proxy?url=https://www.lebensmitteltransparenz.nrw.de/filter/90tage.php?seite=1`);
                    if (response.ok) {
                        const text = await response.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(text, 'text/html');
                        const pageInfo = doc.querySelector('#inhalt > form > label');
                        if (pageInfo) {
                            const pageText = pageInfo.innerText;
                            console.log('Page Info Text:', pageText); // Debug log for page info text
                            if (pageText.includes('von')) {
                                totalPages = parseInt(pageText.match(/von (\d+)/)[1], 10);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error determining total pages:', error.message);
                }

                console.log('Total Pages Before Loop:', totalPages); // Debug log for total pages before loop

                while (currentPage <= totalPages) {
                    console.log('Loading Page:', currentPage); // Debug log for current page
                    const pageBusinesses = await loadBusinessData(currentPage);
                    businesses.push(...pageBusinesses);
                    currentPage++;
                }

                // Hide loading spinner
                document.getElementById('loading').style.display = 'none';

                // Add markers for each business on the map
                businesses.forEach(({ businessName, address, lat, lon }) => {
                    L.marker([lat, lon]).addTo(map)
                        .bindPopup(`<b>Business Name:</b> ${businessName}<br><b>Address:</b> ${address}`);
                });
            }

            // Function to scrape business data dynamically from a single page
            async function loadBusinessData(pageNumber) {
                try {
                    const response = await fetch(`http://localhost:3000/proxy?url=https://www.lebensmitteltransparenz.nrw.de/filter/90tage.php?seite=${pageNumber}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
                    const businesses = [];

                    // Extract business data from the HTML
                    const businessElements = doc.querySelectorAll('table');
                    if (businessElements.length === 0) {
                        console.warn('No business elements found in the HTML.');
                    }

                    for (const table of businessElements) {
                        let street = '';
                        let city = '';
                        let businessName = '';
                        let fullAddress = '';

                        const rows = table.querySelectorAll('tr');
                        rows.forEach(row => {
                            const ths = row.querySelectorAll('th');
                            if (ths.length > 1) {
                                const key = ths[0].textContent.trim();
                                const value = ths[1].textContent.trim();

                                if ((key.includes('Lebensmittelunternehmer') || key.includes('Name')) && !value.match(/(Gastronomie|Bäckerei|Lebensmitteleinzelhandel|Imbiss|Konditorei)/i)) {
                                    businessName = value;
                                } else if (key.includes('Straße') || key.includes('Str.') || key.toLowerCase().includes('address')) {
                                    street = value;
                                } else if (key.includes('Ort') || key.toLowerCase().includes('city')) {
                                    city = value;
                                }
                            }
                        });

                        // If no street and city were found, attempt to parse rows for patterns
                        if (!street || !city) {
                            rows.forEach(row => {
                                const text = row.textContent.trim();
                                if (!street && text.match(/(strasse|straße|str\.)/i)) {
                                    street = text;
                                } else if (!city && text.match(/\d{5}\s[a-zA-Zäöüß]+/)) {
                                    city = text;
                                }
                            });
                        }

                        // Correct street format if missing space between street name and number
                        street = street.replace(/([a-zA-Zäöüß]+)(\d+)/, '$1 $2');

                        // Ensure we have a valid street and city before constructing the address
                        if (street && city) {
                            fullAddress = `${street}, ${city}`;
                        } else {
                            continue; // Continue processing other entries
                        }

                        if (fullAddress.trim() === '') {
                            continue; // Continue processing other entries
                        }

                        try {
                            const latLon = await getCoordinates(fullAddress);
                            const lat = latLon.lat;
                            const lon = latLon.lon;
                            businesses.push({ businessName, address: fullAddress, lat, lon });
                        } catch (error) {
                            console.warn('Error fetching coordinates:', error.message, 'Status:', error.response?.status);
                        }
                    }
                    return businesses;
                } catch (error) {
                    console.warn('Error scraping business data:', error.message, 'Status:', error.response?.status);
                    return [];
                }
            }

            // Function for converting addresses to coordinates using Nominatim (OpenStreetMap)
            async function getCoordinates(address) {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    const data = await response.json();
                    if (data.length > 0) {
                        return {
                            lat: parseFloat(data[0].lat),
                            lon: parseFloat(data[0].lon)
                        };
                    } else {
                        throw new Error('No coordinates found for address: ' + address);
                    }
                } catch (error) {
                    console.warn('Error fetching coordinates:', error.message, 'Status:', error.response?.status);
                    return { lat: MAP_LATITUDE, lon: MAP_LONGITUDE }; // Fallback coordinates
                }
            }

            loadAllBusinessData();
        });