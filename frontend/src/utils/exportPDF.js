// src/utils/exportPDF.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportarEstadisticasPDF = async (elementoId, titulo) => {
  const elemento = document.getElementById(elementoId);
  
  if (!elemento) {
    console.error('Elemento no encontrado');
    return;
  }

  try {
    // Mostrar loading
    const loadingToast = document.createElement('div');
    loadingToast.className = 'fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    loadingToast.textContent = 'Generando PDF...';
    document.body.appendChild(loadingToast);

    // Capturar el elemento como canvas
    const canvas = await html2canvas(elemento, {
      scale: 2,
      backgroundColor: '#f5f0e8',
      logging: false,
      useCORS: true
    });

    // Crear PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 190; // mm
    const pageHeight = 297; // mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 10;

    // Agregar título
    pdf.setFontSize(18);
    pdf.setTextColor(90, 74, 58);
    pdf.text(titulo, 105, 20, { align: 'center' });
    
    // Agregar fecha
    pdf.setFontSize(10);
    pdf.setTextColor(138, 122, 106);
    const fechaActual = new Date().toLocaleDateString('es-AR');
    pdf.text(`Generado: ${fechaActual}`, 105, 30, { align: 'center' });

    // Agregar la imagen al PDF
    pdf.addImage(imgData, 'PNG', 10, 40, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 50);

    // Si hay más contenido, agregar nuevas páginas
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);
    }

    // Guardar PDF
    pdf.save(`estadisticas_${titulo.replace(/\s/g, '_')}_${fechaActual}.pdf`);
    
    // Remover loading
    loadingToast.remove();
    
    // Mostrar éxito
    const successToast = document.createElement('div');
    successToast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    successToast.textContent = '✅ PDF exportado correctamente';
    document.body.appendChild(successToast);
    setTimeout(() => successToast.remove(), 3000);
    
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert('Error al generar el PDF');
  }
};