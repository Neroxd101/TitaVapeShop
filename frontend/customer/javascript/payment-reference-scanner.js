window.PaymentReferenceScanner = {
  async read(photo) {
    const worker = await window.Tesseract.createWorker('eng', 1, {
      langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'
    });
    try {
      const { data } = await worker.recognize(photo);
      const match = data.text.match(/\b(?:reference|ref)\.?[ \t]*(?:number\b|no\.?|#)?[ \t:.#-]*\r?\n?[ \t]*([0-9](?:[0-9 \t-]*[0-9])?)(?![\w-])/i);
      const reference = match?.[1].replace(/[ \t-]/g, '');
      return reference && reference.length >= 6 && reference.length <= 14 ? reference : null;
    } finally {
      await worker.terminate();
    }
  }
};
