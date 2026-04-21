// src/utils/exportPDF.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportarEstadisticasPDF = async (elementoId, titulo) => {
  console.log('🔍 Iniciando exportación...');
  console.log('Buscando elemento con ID:', elementoId);
  
  const elemento = document.getElementById(elementoId);
  
  if (!elemento) {
    console.error('❌ Elemento NO encontrado');
    alert('Error: No se encontró el elemento con ID: ' + elementoId);
    return;
  }
  
  console.log('✅ Elemento encontrado:', elemento);
  console.log('Contenido del elemento:', elemento.innerHTML.substring(0, 200));
  
  const loadingToast = document.createElement('div');
  loadingToast.className = 'fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
  loadingToast.innerHTML = '📄 Generando PDF...';
  document.body.appendChild(loadingToast);
  
  try {
    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('📸 Capturando con html2canvas...');
    const canvas = await html2canvas(elemento, {
      scale: 1,
      backgroundColor: '#ffffff',
      logging: true,
      useCORS: false
    });
    
    console.log('✅ Canvas generado:', canvas.width, 'x', canvas.height);
    
    const imgData = canvas.toDataURL('image/png');
    console.log('📷 Imagen generada, longitud:', imgData.length);
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.setFontSize(16);
    pdf.text(titulo, 105, 15, { align: 'center' });
    
    const fechaActual = new Date().toLocaleDateString('es-AR');
    pdf.setFontSize(10);
    pdf.text(`Generado: ${fechaActual}`, 105, 22, { align: 'center' });
    
    pdf.addImage(imgData, 'PNG', 10, 30, imgWidth, imgHeight);
    
    const fechaArchivo = new Date().toISOString().split('T')[0].replace(/-/g, '_');
    pdf.save(`estadisticas_prueba_${fechaArchivo}.pdf`);
    
    console.log('💾 PDF guardado');
    
    loadingToast.remove();
    
    const successToast = document.createElement('div');
    successToast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    successToast.innerHTML = '✅ PDF generado correctamente';
    document.body.appendChild(successToast);
    setTimeout(() => successToast.remove(), 3000);
    
  } catch (error) {
    console.error('❌ Error detallado:', error);
    loadingToast.remove();
    alert('Error al generar PDF: ' + error.message);
  }
};