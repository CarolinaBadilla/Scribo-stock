// src/utils/exportPDF.js - Versión alternativa
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportarEstadisticasPDF = async (elementoId, titulo) => {
  const elemento = document.getElementById(elementoId);
  
  if (!elemento) {
    alert('No se encontró el elemento');
    return;
  }

  const loadingToast = document.createElement('div');
  loadingToast.className = 'fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
  loadingToast.innerHTML = '📄 Generando PDF...';
  document.body.appendChild(loadingToast);

  try {
    // Esperar a que los gráficos se rendericen
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Crear un clon del elemento para no afectar la vista
    const clone = elemento.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.width = '800px';
    clone.style.backgroundColor = '#ffffff';
    document.body.appendChild(clone);

    // Capturar el clon
    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    });

    // Remover el clon
    document.body.removeChild(clone);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.setFontSize(16);
    pdf.setTextColor(90, 74, 58);
    pdf.text(titulo, 105, 15, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.setTextColor(138, 122, 106);
    const fechaActual = new Date().toLocaleDateString('es-AR');
    pdf.text(`Generado: ${fechaActual}`, 105, 22, { align: 'center' });

    pdf.addImage(imgData, 'PNG', 10, 30, imgWidth, imgHeight);
    
    const fechaArchivo = new Date().toISOString().split('T')[0].replace(/-/g, '_');
    pdf.save(`estadisticas_${fechaArchivo}.pdf`);
    
    loadingToast.remove();
    
    const successToast = document.createElement('div');
    successToast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    successToast.innerHTML = '✅ PDF generado correctamente';
    document.body.appendChild(successToast);
    setTimeout(() => successToast.remove(), 3000);
    
  } catch (error) {
    console.error('Error:', error);
    loadingToast.remove();
    alert('Error al generar el PDF');
  }
};