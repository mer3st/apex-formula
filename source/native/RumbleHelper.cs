using System;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32.SafeHandles;

// Restricted DS4 Bluetooth output bridge; never reads buttons or changes mappings.
class RumbleHelper {
    [StructLayout(LayoutKind.Sequential)] struct Interface { public int size; public Guid guid; public int flags; public IntPtr reserved; }
    [DllImport("hid.dll")] static extern void HidD_GetHidGuid(out Guid guid);
    [DllImport("setupapi.dll",CharSet=CharSet.Unicode)] static extern IntPtr SetupDiGetClassDevs(ref Guid guid,IntPtr enumerator,IntPtr hwnd,uint flags);
    [DllImport("setupapi.dll")] static extern bool SetupDiEnumDeviceInterfaces(IntPtr set,IntPtr info,ref Guid guid,uint index,ref Interface data);
    [DllImport("setupapi.dll",CharSet=CharSet.Unicode)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set,ref Interface data,IntPtr detail,uint size,out uint needed,IntPtr info);
    [DllImport("setupapi.dll")] static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
    [DllImport("hid.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.U1)] static extern bool HidD_SetOutputReport(SafeFileHandle handle,byte[] data,int length);
    static SafeFileHandle device;
    static int product;
    static readonly object gate=new object();
    static Timer timer;
    static DateTime deadline=DateTime.MinValue;
    static byte[] Report(int strong,int weak){
        byte[] data=new byte[78];data[0]=0x11;data[1]=0xc0;data[2]=0x20;data[3]=0xf1;data[4]=4;
        data[6]=(byte)weak;data[7]=(byte)strong;data[21]=data[22]=0x43;data[24]=0x4d;data[25]=0x85;
        uint crc=0xffffffff;
        for(int i=-1;i<74;i++){crc^=i<0?(byte)0xa2:data[i];for(int b=0;b<8;b++)crc=(crc>>1)^((crc&1)!=0?0xedb88320u:0);}
        crc=~crc;for(int i=0;i<4;i++)data[74+i]=(byte)(crc>>(8*i));return data;
    }
    static void Close(){if(device!=null){device.Dispose();device=null;}}
    static void Stop(){deadline=DateTime.MinValue;if(device!=null&&!device.IsInvalid){var data=Report(0,0);if(!HidD_SetOutputReport(device,data,data.Length))Close();}}
    static void Open(int pid){
        if(device!=null&&product==pid)return;
        Stop();Close();
        Guid guid;HidD_GetHidGuid(out guid);IntPtr set=SetupDiGetClassDevs(ref guid,IntPtr.Zero,IntPtr.Zero,0x12);
        string found=null;
        try{
            for(uint i=0;;i++){
                Interface entry=new Interface();entry.size=Marshal.SizeOf(entry);
                if(!SetupDiEnumDeviceInterfaces(set,IntPtr.Zero,ref guid,i,ref entry))break;
                uint length;SetupDiGetDeviceInterfaceDetail(set,ref entry,IntPtr.Zero,0,out length,IntPtr.Zero);
                IntPtr detail=Marshal.AllocHGlobal((int)length);
                try{
                    Marshal.WriteInt32(detail,IntPtr.Size==8?8:6);
                    if(!SetupDiGetDeviceInterfaceDetail(set,ref entry,detail,length,out length,IntPtr.Zero))continue;
                    string path=Marshal.PtrToStringUni(IntPtr.Add(detail,4)).ToLowerInvariant();
                    if(path.Contains("{00001124-")&&path.Contains("vid&0002054c_pid&"+pid.ToString("x4"))){
                        if(found!=null)throw new Exception("AMBIGUOUS_CONTROLLER");found=path;
                    }
                }finally{Marshal.FreeHGlobal(detail);}
            }
        }finally{SetupDiDestroyDeviceInfoList(set);}
        if(found==null)throw new Exception("NO_BLUETOOTH_DS4");
        device=CreateFile(found,0xc0000000,3,IntPtr.Zero,3,0,IntPtr.Zero);product=pid;
        if(device.IsInvalid){Close();throw new Exception("OPEN_FAILED");}
    }
    static void Main(){
        timer=new Timer(delegate{lock(gate){if(deadline!=DateTime.MinValue&&DateTime.UtcNow>=deadline)Stop();}},null,25,25);
        try{
            string line;
            while((line=Console.ReadLine())!=null){
                string[] fields=line.Split(' ');int id=0;
                try{
                    if(fields.Length!=5)throw new Exception("INVALID_REQUEST");
                    id=int.Parse(fields[0]);int pid=int.Parse(fields[1]),strong=int.Parse(fields[2]),weak=int.Parse(fields[3]),duration=int.Parse(fields[4]);
                    if((pid!=2508&&pid!=1476)||strong<0||strong>255||weak<0||weak>255||duration<0||duration>2000)throw new Exception("INVALID_REQUEST");
                    lock(gate){
                        if(duration==0){Stop();Close();}
                        else{Open(pid);byte[] data=Report(strong,weak);if(!HidD_SetOutputReport(device,data,data.Length)){Close();throw new Exception("WRITE_FAILED");}deadline=DateTime.UtcNow.AddMilliseconds(duration);}
                    }
                    Console.WriteLine(id+" OK");
                }catch(Exception e){Console.WriteLine(id+" "+e.Message.Replace(' ','_'));}
            }
        }finally{lock(gate){Stop();Close();}timer.Dispose();}
    }
}
