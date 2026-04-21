// src/utils/exportPDF.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportarEstadisticasPDF = async (elementoId, titulo) => {
  // Esperar un poco para asegurar que los gráficos están renderizados
  const elemento = document.getElementById(elementoId);
  
  if (!elemento) {
    console.error('Elemento no encontrado');
    alert('No se encontró el elemento para exportar');
    return;
  }

  // Mostrar loading
  const loadingToast = document.createElement('div');
  loadingToast.className = 'fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
  loadingToast.innerHTML = '📄 Generando PDF...';
  document.body.appendChild(loadingToast);

  try {
    // Esperar a que los gráficos se rendericen
    await new Promise(resolve => setTimeout(resolve, 500));

    // Capturar el elemento
    const canvas = await html2canvas(elemento, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: false,
      windowWidth: elemento.scrollWidth,
      windowHeight: elemento.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 190;
    const pageHeight = 277;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let position = 20;

    // Título
    pdf.setFontSize(16);
    pdf.setTextColor(90, 74, 58);
    pdf.text(titulo, 105, 15, { align: 'center' });
    
    // Fecha
    pdf.setFontSize(10);
    pdf.setTextColor(138, 122, 106);
    const fechaActual = new Date().toLocaleDateString('es-AR');
    pdf.text(`Generado: ${fechaActual}`, 105, 22, { align: 'center' });

    // Agregar imagen
    pdf.addImage(imgData, 'PNG', 10, 30, imgWidth, imgHeight);
    
    // Guardar
    const fechaArchivo = new Date().toISOString().split('T')[0].replace(/-/g, '_');
    pdf.save(`estadisticas_${fechaArchivo}.pdf`);
    
    loadingToast.remove();
    
    // Toast de éxito
    const successToast = document.createElement('div');
    successToast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    successToast.innerHTML = '✅ PDF generado correctamente';
    document.body.appendChild(successToast);
    setTimeout(() => successToast.remove(), 3000);
    
  } catch (error) {
    console.error('Error al generar PDF:', error);
    loadingToast.remove();
    alert('Error al generar el PDF: ' + error.message);
  }
};