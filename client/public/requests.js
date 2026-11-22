const el=id=>document.getElementById(id);
el('send').onclick=async()=>{
 const [method,path]=el('op').value.split(' ');
 try{
 if(path.includes(':id')&&!el('item').value.trim())throw Error('항목 번호를 입력하세요.');
 const options={method};
 if(['POST','PUT'].includes(method)){options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(JSON.parse(el('body').value));}
 if(method!=='GET'&&!confirm('이 요청을 로컬 서버에 보내시겠어요?'))return;
 const response=await fetch(path.replace(':id',encodeURIComponent(el('item').value.trim())),options);
 el('result').textContent=response.status+' '+response.statusText+'\n'+JSON.stringify(await response.json(),null,2);
 }catch(error){el('result').textContent=error.message;}
};