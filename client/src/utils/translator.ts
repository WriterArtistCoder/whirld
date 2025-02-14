export const translateText = async (lang: string, text: string, times: number) => {
  try {
    const response = await fetch(
      `http://localhost:3193/api/scramble`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lang,
          text,
          times
        })
      }
    ); 

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Here's the data", data)

    return data.bamboozled;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original text if translation fails
  }
};